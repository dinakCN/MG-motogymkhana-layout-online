export function loadConfig() {
  const stageId = process.env.STAGE_ID || '677'
  return {
    port: Number(process.env.PORT) || 4300,
    stageId,
    stageUrl: `https://gymkhana-cup.ru/competitions/stage?id=${stageId}`,
    pollInterval: Number(process.env.POLL_INTERVAL) || 7000,
    highlightTimeout: 6000,
    showClassTop5: true,
  }
}

export const config = loadConfig()
