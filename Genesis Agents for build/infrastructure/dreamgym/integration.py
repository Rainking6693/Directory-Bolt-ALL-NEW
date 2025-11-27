from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING

from infrastructure.dreamgym.curriculum import DreamGymCurriculumGenerator
from infrastructure.dreamgym.experience_model import DreamGymExperience, DreamGymExperienceModel
from infrastructure.dreamgym.hybrid_buffer import HybridReplayBuffer
from infrastructure.memory.codebook_store import get_codebook_store

if TYPE_CHECKING:
    from infrastructure.trajectory_pool import Trajectory


class DreamGymTrainer:
    """
    Coordinates DreamGym components for SE-Darwin evolution.
    """

    def __init__(self, agent_name: str) -> None:
        self.agent_name = agent_name
        self.model = DreamGymExperienceModel()
        self.curriculum = DreamGymCurriculumGenerator()
        self.buffer = HybridReplayBuffer()
        self.codebooks = get_codebook_store()

    def record_real_trajectory(self, trajectory: "Trajectory") -> None:
        experience = self._real_to_experience(trajectory)
        self.buffer.add(experience, source="real")
        self.curriculum.record_outcome(
            experience.task_signature,
            experience.reward,
            experience.novelty_score,
        )
        snippet = trajectory.reasoning_pattern or trajectory.proposed_strategy or ""
        context = {"problem": trajectory.problem_diagnosis, "status": trajectory.status}
        try:
            self.codebooks.record_entry(
                agent_name=self.agent_name,
                snippet=snippet,
                context=context,
                status=trajectory.status,
                score=trajectory.success_score,
            )
        except Exception:
            pass

    def _real_to_experience(self, trajectory: "Trajectory") -> DreamGymExperience:
        task_signature = trajectory.operator_applied or "baseline"
        reward = max(0.0, min(1.0, trajectory.success_score))
        novelty = 0.6 if trajectory.reasoning_pattern else 0.7
        metadata = {
            "generation": trajectory.generation,
            "agent": trajectory.agent_name,
            "status": trajectory.status,
        }
        return DreamGymExperience(
            task_signature=task_signature,
            difficulty="real",
            synthetic=False,
            observation=trajectory.problem_diagnosis or "N/A",
            action=trajectory.code_changes or "",
            reward=reward,
            novelty_score=novelty,
            generated_at=trajectory.created_at,
            metadata=metadata,
        )

    def generate_synthetic_batch(self, task_signature: str, batch_size: int = 16) -> List[Dict[str, Any]]:
        stage = self.curriculum.next_stage(task_signature)
        experiences: List[Dict[str, Any]] = []
        codebook_hints = self.codebooks.recent(self.agent_name, limit=3)
        for _ in range(batch_size):
            exp = self.model.generate_episode(task_signature, stage)
            self.buffer.add(exp, "synthetic")
            self.curriculum.record_outcome(task_signature, exp.reward, exp.novelty_score)
            exp_dict = exp.to_dict()
            exp_dict["codebook_hints"] = codebook_hints
            experiences.append(exp_dict)
        return experiences

    def prepare_evolution_batch(
        self,
        task_signature: str,
        batch_size: int = 32,
        synthetic_ratio: float = 0.5,
    ) -> List[Dict[str, Any]]:
        samples = self.buffer.sample(batch_size, synthetic_ratio)
        deficit = batch_size - len(samples)
        if deficit > 0:
            samples.extend(self.generate_synthetic_batch(task_signature, deficit))

        if samples:
            hints = self.codebooks.recent(self.agent_name, limit=3)
            for sample in samples:
                data = sample if isinstance(sample, dict) else sample.to_dict()
                data.setdefault("codebook_hints", hints)

        return [
            sample if isinstance(sample, dict) else sample.to_dict()
            for sample in samples
        ]

    def stats(self) -> Dict[str, Any]:
        buffer_stats = self.buffer.stats()
        return {
            "agent": self.agent_name,
            "buffer_real": buffer_stats["real"],
            "buffer_synthetic": buffer_stats["synthetic"],
        }
