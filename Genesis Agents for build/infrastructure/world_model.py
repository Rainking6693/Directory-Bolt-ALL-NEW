"""
World Model - Implicit Environment Prediction
Layer 2 component for Darwin self-improvement

PURPOSE: Predict outcomes of actions BEFORE executing them in sandbox
- Lightweight LSTM/Transformer predicts next state
- Validates candidate code edits before deployment
- Reduces expensive sandbox executions
- Learned from Replay Buffer trajectories

Based on research:
- Implicit world modeling (no reward needed initially)
- Off-policy learning from experience
- Fast forward simulation

Key Features:
- Predicts: (state, action) → next_state, success_probability
- Trained on successful AND failed trajectories
- Fast inference (<10ms per prediction)
- Continuously updated from Replay Buffer
"""

import asyncio
import json
import logging
import os
import numpy as np
import pickle
from collections import deque
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("PyTorch not available - WorldModel will use simple heuristics")

from infrastructure import get_replay_buffer, OutcomeTag, get_logger

logger = get_logger("world_model")

try:
    from infrastructure.training import FP16Trainer, FP16TrainingConfig
except Exception as exc:  # pragma: no cover - fallback when training module unavailable
    FP16Trainer = None  # type: ignore
    FP16TrainingConfig = None  # type: ignore
    logger.info("FP16 training utilities unavailable: %s", exc)


@dataclass
class WorldState:
    """Representation of environment state"""
    agent_name: str
    code_snapshot: str  # Hash or summary of current code
    recent_actions: List[str]  # Last N actions taken
    metrics: Dict[str, float]  # Current performance metrics
    context: Dict[str, Any]  # Additional context


@dataclass
class Prediction:
    """World model prediction"""
    next_state: WorldState
    success_probability: float  # 0.0 to 1.0
    expected_improvement: float  # Predicted metric delta
    confidence: float  # Model confidence in prediction
    reasoning: str  # Explanation (if available)


class WorldModel:
    """
    Lightweight world model for predicting action outcomes

    Architecture:
    - State encoder: Embed state into fixed-size vector
    - Action encoder: Embed action/code change into vector
    - Predictor network: LSTM/Transformer predicts next state + success
    - Training: Supervised learning on Replay Buffer trajectories

    Usage:
        model = WorldModel()
        await model.train()  # Train on historical data

        # Predict outcome before executing
        prediction = await model.predict(current_state, proposed_action)
        if prediction.success_probability > 0.7:
            # Execute action
            pass
    """

    def __init__(
        self,
        state_dim: int = 128,
        action_dim: int = 128,
        hidden_dim: int = 256,
        model_path: Optional[Path] = None,
    ):
        """
        Initialize world model

        Args:
            state_dim: State embedding dimension
            action_dim: Action embedding dimension
            hidden_dim: Hidden layer dimension
            model_path: Path to saved model (None = create new)
        """
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.hidden_dim = hidden_dim
        self.model_path = model_path or Path("models/world_model.pt")

        # Initialize model
        if TORCH_AVAILABLE:
            self.model = self._build_pytorch_model()
            self.optimizer = optim.Adam(self.model.parameters(), lr=0.001)
            self.criterion = nn.MSELoss()

            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.model.to(self.device)

            # Load if exists
            if self.model_path.exists():
                self._load_model()
        else:
            # Fallback to simple heuristic model
            self.model = None
            self.heuristic_model = self._build_heuristic_model()
            self.device = None

        # Training history
        self.training_history = []
        self._fp16_trainer: Optional[FP16Trainer] = None
        self._fp16_stats: Optional[Dict[str, Any]] = None

        enable_fp16 = os.getenv("ENABLE_FP16_TRAINING", "false").lower() == "true"
        self.fp16_enabled = (
            TORCH_AVAILABLE
            and FP16Trainer is not None
            and enable_fp16
            and torch.cuda.is_available()
        )
        if self.fp16_enabled:
            self.fp16_config = FP16TrainingConfig()
            logger.info("FP16 training enabled for WorldModel")
        else:
            self.fp16_config = None
            if enable_fp16 and (not TORCH_AVAILABLE or not torch.cuda.is_available()):
                logger.warning(
                    "ENABLE_FP16_TRAINING set but CUDA/AMP is unavailable; proceeding with FP32"
                )

        # Connect to Replay Buffer
        self.replay_buffer = get_replay_buffer()

        logger.info(f"WorldModel initialized (PyTorch: {TORCH_AVAILABLE})")

    def _build_pytorch_model(self):
        """Build PyTorch neural network model"""
        if not TORCH_AVAILABLE:
            raise RuntimeError("PyTorch not available")

        class WorldModelNetwork(nn.Module):
            def __init__(self, state_dim, action_dim, hidden_dim):
                super().__init__()

                # State encoder
                self.state_encoder = nn.Sequential(
                    nn.Linear(state_dim, hidden_dim),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                    nn.Linear(hidden_dim, hidden_dim),
                )

                # Action encoder
                self.action_encoder = nn.Sequential(
                    nn.Linear(action_dim, hidden_dim),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                    nn.Linear(hidden_dim, hidden_dim),
                )

                # Fusion layer
                self.fusion = nn.Sequential(
                    nn.Linear(hidden_dim * 2, hidden_dim),
                    nn.ReLU(),
                    nn.Dropout(0.3),
                )

                # LSTM for temporal modeling
                self.lstm = nn.LSTM(hidden_dim, hidden_dim, num_layers=2, batch_first=True)

                # Output heads
                self.success_head = nn.Sequential(
                    nn.Linear(hidden_dim, 64),
                    nn.ReLU(),
                    nn.Linear(64, 1),
                    nn.Sigmoid(),  # Success probability
                )

                self.improvement_head = nn.Sequential(
                    nn.Linear(hidden_dim, 64),
                    nn.ReLU(),
                    nn.Linear(64, 1),
                    nn.Tanh(),  # Improvement delta (-1 to +1)
                )

            def forward(self, state, action):
                # Encode state and action
                state_enc = self.state_encoder(state)
                action_enc = self.action_encoder(action)

                # Fuse
                fused = torch.cat([state_enc, action_enc], dim=-1)
                fused = self.fusion(fused)

                # Add sequence dimension for LSTM
                if len(fused.shape) == 2:
                    fused = fused.unsqueeze(1)

                # LSTM forward
                lstm_out, _ = self.lstm(fused)
                lstm_out = lstm_out[:, -1, :]  # Take last output

                # Predictions
                success_prob = self.success_head(lstm_out)
                improvement = self.improvement_head(lstm_out)

                return success_prob, improvement

        return WorldModelNetwork(self.state_dim, self.action_dim, self.hidden_dim)

    def _build_heuristic_model(self) -> Dict[str, Any]:
        """Build simple heuristic model (fallback when PyTorch unavailable)"""
        return {
            "success_baseline": 0.5,
            "improvement_baseline": 0.0,
            "learned_patterns": {},
        }

    async def train(self, num_epochs: int = 10, batch_size: int = 32):
        """
        Train world model on historical trajectories from Replay Buffer

        Args:
            num_epochs: Number of training epochs
            batch_size: Batch size for training
        """
        logger.info("🎓 Training world model on historical data...")

        # Get trajectories from Replay Buffer
        trajectories = self.replay_buffer.sample(limit=1000)

        if not trajectories:
            logger.warning("No trajectories available for training")
            return

        logger.info(f"Training on {len(trajectories)} trajectories")

        if not TORCH_AVAILABLE:
            # Fallback: Update heuristics
            await self._train_heuristic(trajectories)
            return

        # Prepare training data
        X_states, X_actions, y_success, y_improvement = self._prepare_training_data(trajectories)

        if len(X_states) == 0:
            logger.warning("No valid training data")
            return

        # Training loop
        self.model.train()

        trainer = None
        if self.fp16_enabled and FP16Trainer is not None:
            try:
                trainer = FP16Trainer(self.model, self.optimizer, self.fp16_config)
                self._fp16_trainer = trainer
            except RuntimeError as exc:
                logger.warning("FP16 trainer initialization failed: %s. Falling back to FP32.", exc)
                trainer = None
                self.fp16_enabled = False

        def compute_loss_fn(model, batch):
            states = batch["states"]
            actions = batch["actions"]
            target_success = batch["success"]
            target_improvement = batch["improvement"]

            pred_success, pred_improvement = model(states, actions)
            loss_success = self.criterion(pred_success.squeeze(), target_success)
            loss_improvement = self.criterion(pred_improvement.squeeze(), target_improvement)
            return loss_success + loss_improvement

        overflow_batches = 0
        clip_grad = None
        if TORCH_AVAILABLE:
            from torch.nn.utils import clip_grad_norm_

            clip_grad = clip_grad_norm_

        for epoch in range(num_epochs):
            epoch_loss = 0.0
            num_batches = 0

            # Mini-batch training
            for i in range(0, len(X_states), batch_size):
                batch_states = X_states[i:i + batch_size].to(self.device)
                batch_actions = X_actions[i:i + batch_size].to(self.device)
                batch_success = y_success[i:i + batch_size].to(self.device)
                batch_improvement = y_improvement[i:i + batch_size].to(self.device)

                batch = {
                    "states": batch_states,
                    "actions": batch_actions,
                    "success": batch_success,
                    "improvement": batch_improvement,
                }

                if trainer is not None:
                    loss = trainer.training_step(batch, compute_loss_fn)
                    step_ok = trainer.backward_and_step(loss)
                    if not step_ok:
                        overflow_batches += 1
                        continue
                else:
                    self.optimizer.zero_grad(set_to_none=True)
                    loss = compute_loss_fn(self.model, batch)
                    loss.backward()
                    if clip_grad is not None:
                        clip_grad(self.model.parameters(), max_norm=1.0)
                    self.optimizer.step()

                epoch_loss += loss.item()
                num_batches += 1

            avg_loss = epoch_loss / max(num_batches, 1)
            logger.info(f"Epoch {epoch + 1}/{num_epochs}: loss = {avg_loss:.4f}")

            self.training_history.append({
                "epoch": epoch + 1,
                "loss": avg_loss,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "fp16_overflow_batches": overflow_batches,
            })

        if trainer is not None:
            self._fp16_stats = trainer.get_stats()
            logger.info("FP16 training stats: %s", self._fp16_stats)
            self._fp16_trainer = None

        # Save model
        self._save_model()

        logger.info("✅ Training complete")

    def _prepare_training_data(self, trajectories: List[Dict]) -> Tuple:
        """Prepare training data from trajectories"""
        X_states = []
        X_actions = []
        y_success = []
        y_improvement = []

        for traj in trajectories:
            try:
                # Extract features
                state_vec = self._encode_state_simple(traj)
                action_vec = self._encode_action_simple(traj)

                # Labels
                success = 1.0 if traj.get("final_outcome") == OutcomeTag.SUCCESS.value else 0.0
                improvement = traj.get("final_reward", 0.0)

                X_states.append(state_vec)
                X_actions.append(action_vec)
                y_success.append(success)
                y_improvement.append(improvement)

            except Exception as e:
                logger.warning(f"Failed to process trajectory: {e}")
                continue

        if not X_states:
            return torch.tensor([]), torch.tensor([]), torch.tensor([]), torch.tensor([])

        return (
            torch.tensor(X_states, dtype=torch.float32),
            torch.tensor(X_actions, dtype=torch.float32),
            torch.tensor(y_success, dtype=torch.float32),
            torch.tensor(y_improvement, dtype=torch.float32),
        )

    def _encode_state_simple(self, traj: Dict) -> List[float]:
        """Simple state encoding (in production, use proper embeddings)"""
        # Mock encoding: just use metrics + random padding
        metrics = traj.get("initial_state", {}).get("metrics", {})

        vec = [0.0] * self.state_dim
        vec[0] = metrics.get("overall_score", 0.5)
        vec[1] = metrics.get("correctness", 0.5)
        vec[2] = len(traj.get("actions", []))  # Trajectory length
        vec[3] = float(traj.get("final_outcome") == OutcomeTag.SUCCESS.value)

        return vec

    def _encode_action_simple(self, traj: Dict) -> List[float]:
        """Simple action encoding"""
        actions = traj.get("actions", [])

        vec = [0.0] * self.action_dim
        if actions:
            vec[0] = float(len(actions))
            vec[1] = float(any("error" in str(a).lower() for a in actions))

        return vec

    async def _train_heuristic(self, trajectories: List[Dict]):
        """Train simple heuristic model (fallback)"""
        # Compute success rate
        successes = sum(1 for t in trajectories if t.get("final_outcome") == OutcomeTag.SUCCESS.value)
        self.heuristic_model["success_baseline"] = successes / max(len(trajectories), 1)

        # Compute average improvement
        improvements = [t.get("final_reward", 0.0) for t in trajectories]
        self.heuristic_model["improvement_baseline"] = np.mean(improvements) if improvements else 0.0

        logger.info(f"Heuristic model updated: success_rate={self.heuristic_model['success_baseline']:.2f}")

    async def predict(
        self,
        current_state: WorldState,
        proposed_action: str,
    ) -> Prediction:
        """
        Predict outcome of proposed action

        Args:
            current_state: Current environment state
            proposed_action: Proposed code change or action

        Returns:
            Prediction with success probability and expected improvement
        """
        if not TORCH_AVAILABLE:
            return await self._predict_heuristic(current_state, proposed_action)

        self.model.eval()

        with torch.no_grad():
            # Encode state and action
            state_vec = self._encode_state_from_worldstate(current_state)
            action_vec = self._encode_action_from_string(proposed_action)

            # Convert to tensors
            state_tensor = torch.tensor([state_vec], dtype=torch.float32)
            action_tensor = torch.tensor([action_vec], dtype=torch.float32)

            # Forward pass
            success_prob, improvement = self.model(state_tensor, action_tensor)

            # Extract values
            success_prob_val = success_prob.item()
            improvement_val = improvement.item()

            # Estimate confidence based on training history
            confidence = 0.7 if self.training_history else 0.5

            return Prediction(
                next_state=current_state,  # Simplified: don't predict full state
                success_probability=success_prob_val,
                expected_improvement=improvement_val,
                confidence=confidence,
                reasoning=f"Model predicts {success_prob_val:.1%} success with {improvement_val:+.3f} improvement",
            )

    async def _predict_heuristic(self, current_state: WorldState, proposed_action: str) -> Prediction:
        """Heuristic prediction (fallback)"""
        # Simple heuristic: use baseline + small random variation
        success_prob = self.heuristic_model["success_baseline"] + (np.random.random() - 0.5) * 0.2
        success_prob = max(0.0, min(1.0, success_prob))

        improvement = self.heuristic_model["improvement_baseline"] + (np.random.random() - 0.5) * 0.1

        return Prediction(
            next_state=current_state,
            success_probability=success_prob,
            expected_improvement=improvement,
            confidence=0.3,  # Low confidence for heuristic
            reasoning="Heuristic prediction based on historical averages",
        )

    def _encode_state_from_worldstate(self, state: WorldState) -> List[float]:
        """Encode WorldState to vector"""
        vec = [0.0] * self.state_dim

        # Simple encoding
        metrics = state.metrics
        vec[0] = metrics.get("overall_score", 0.5)
        vec[1] = metrics.get("correctness", 0.5)
        vec[2] = metrics.get("efficiency", 0.5)
        vec[3] = len(state.recent_actions)

        return vec

    def _encode_action_from_string(self, action: str) -> List[float]:
        """Encode action string to vector"""
        vec = [0.0] * self.action_dim

        # Simple encoding based on keywords
        action_lower = action.lower()
        vec[0] = float("def " in action_lower)  # Function definition
        vec[1] = float("class " in action_lower)  # Class definition
        vec[2] = float("import " in action_lower)  # Import statement
        vec[3] = float("return " in action_lower)  # Return statement
        vec[4] = float(len(action))  # Code length

        return vec

    def _save_model(self):
        """Save model to disk"""
        if not TORCH_AVAILABLE:
            return

        self.model_path.parent.mkdir(parents=True, exist_ok=True)

        torch.save({
            "model_state": self.model.state_dict(),
            "optimizer_state": self.optimizer.state_dict(),
            "training_history": self.training_history,
        }, self.model_path)

        logger.info(f"Model saved: {self.model_path}")

    def _load_model(self):
        """Load model from disk (SECURE)"""
        if not TORCH_AVAILABLE:
            return

        # SECURITY FIX (Oct 30, 2025): Use secure checkpoint loading
        # to prevent checkpoint poisoning attacks (CVSS 7.8)
        try:
            from infrastructure.secure_checkpoint import load_checkpoint_secure

            # Convert to safetensors path if loading legacy .pt
            checkpoint_path = Path(self.model_path)
            if checkpoint_path.suffix in [".pt", ".pth"]:
                logger.warning(
                    f"Loading legacy PyTorch checkpoint: {checkpoint_path}\n"
                    f"SECURITY WARNING: This uses torch.load() which can execute arbitrary code!\n"
                    f"Please migrate to .safetensors format using migrate_pytorch_to_safetensors()"
                )
                # Fallback to torch.load with weights_only=True (safer)
                checkpoint = torch.load(self.model_path, map_location="cpu", weights_only=True)
            else:
                # Load with secure checkpoint loader (safetensors + SHA256)
                checkpoint = load_checkpoint_secure(checkpoint_path, device="cpu")
        except ImportError:
            # Fallback if secure_checkpoint not available
            logger.warning("secure_checkpoint module not available, using torch.load (INSECURE!)")
            checkpoint = torch.load(self.model_path, map_location="cpu", weights_only=True)

        self.model.load_state_dict(checkpoint["model_state"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state"])
        self.training_history = checkpoint.get("training_history", [])

        logger.info(f"Model loaded: {self.model_path}")


# Convenience functions
_model_instance = None


def get_world_model() -> WorldModel:
    """Get singleton world model"""
    global _model_instance
    if _model_instance is None:
        _model_instance = WorldModel()
    return _model_instance


async def predict_outcome(current_state: WorldState, proposed_action: str) -> Prediction:
    """
    Convenience function to predict action outcome

    Example:
        state = WorldState(agent_name="spec_agent", ...)
        prediction = await predict_outcome(state, "def new_function(): ...")
        if prediction.success_probability > 0.7:
            # Execute action
            pass
    """
    model = get_world_model()
    return await model.predict(current_state, proposed_action)


if __name__ == "__main__":
    # Test world model
    async def test_world_model():
        model = WorldModel()

        # Train on mock data
        await model.train(num_epochs=3)

        # Test prediction
        state = WorldState(
            agent_name="test_agent",
            code_snapshot="hash123",
            recent_actions=["action1", "action2"],
            metrics={"overall_score": 0.6},
            context={},
        )

        prediction = await model.predict(state, "def improved_function(): return 'better'")

        print(f"\n🔮 Prediction:")
        print(f"Success Probability: {prediction.success_probability:.1%}")
        print(f"Expected Improvement: {prediction.expected_improvement:+.3f}")
        print(f"Confidence: {prediction.confidence:.1%}")
        print(f"Reasoning: {prediction.reasoning}")

    asyncio.run(test_world_model())
