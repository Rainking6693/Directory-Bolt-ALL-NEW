from __future__ import annotations

import time
from typing import List, Optional, Sequence

# REMOVED: Discord integration (integration disabled due to webhook errors)
# from infrastructure.genesis_discord import GenesisDiscord
from infrastructure.hopx_monitor import HopXEnvironmentRecord, HopXMonitor


def find_stuck_environments(
    *,
    max_age_seconds: int = 3600,
    monitor: Optional[HopXMonitor] = None,
) -> List[HopXEnvironmentRecord]:
    """
    Return the environments that exceeded ``max_age_seconds`` and mark them as stuck.
    """

    watcher = monitor or HopXMonitor()
    return list(watcher.detect_stuck(max_age_seconds))


async def notify_stuck_environments(
    records: Sequence[HopXEnvironmentRecord],
    *,
    discord: Optional[object] = None,
) -> List[HopXEnvironmentRecord]:
    """
    Alert about stuck HopX environments (Discord integration disabled).
    """

    if not records:
        return []

    # REMOVED: Discord integration (integration disabled due to webhook errors)
    # close_discord = False
    # if discord is None:
    #     discord = GenesisDiscord()
    #     close_discord = True
    #
    # try:
    #     now = time.time()
    #     for record in records:
    #         age_hours = max(0.0, (now - record.created_at) / 3600.0)
    #         await discord.hopx_environment_stuck(record.env_id, age_hours)
    # finally:
    #     if close_discord:
    #         await discord.close()

    return list(records)
