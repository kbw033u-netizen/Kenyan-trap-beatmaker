(() => {
  const ENVELOPE_RATE = 100;
  const MAX_ANALYSIS_SECONDS = 90;

  function estimateTempo(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const hopSize = Math.max(1, Math.round(sampleRate / ENVELOPE_RATE));
    const sampleLimit = Math.min(audioBuffer.length, sampleRate * MAX_ANALYSIS_SECONDS);
    const frameCount = Math.floor(sampleLimit / hopSize);
    const channelData = Array.from(
      { length: audioBuffer.numberOfChannels },
      (_, channel) => audioBuffer.getChannelData(channel),
    );
    if (frameCount < ENVELOPE_RATE * 2 || channelData.length === 0) return null;

    const envelope = new Float32Array(frameCount);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const start = frame * hopSize;
      const end = Math.min(start + hopSize, sampleLimit);
      let energy = 0;
      for (const channel of channelData) {
        for (let sample = start; sample < end; sample += 1) {
          energy += channel[sample] * channel[sample];
        }
      }
      envelope[frame] = Math.sqrt(energy / ((end - start) * channelData.length));
    }

    const onset = new Float32Array(frameCount);
    let totalOnset = 0;
    for (let frame = 1; frame < frameCount; frame += 1) {
      onset[frame] = Math.max(0, envelope[frame] - envelope[frame - 1]);
      totalOnset += onset[frame];
    }
    if (totalOnset < 1e-5) return null;

    const minimumLag = Math.floor(ENVELOPE_RATE * 60 / 200);
    const maximumLag = Math.ceil(ENVELOPE_RATE * 60 / 60);
    let bestLag = 0;
    let bestScore = 0;
    for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
      let product = 0;
      let currentEnergy = 0;
      let delayedEnergy = 0;
      for (let frame = lag; frame < frameCount; frame += 1) {
        const current = onset[frame];
        const delayed = onset[frame - lag];
        product += current * delayed;
        currentEnergy += current * current;
        delayedEnergy += delayed * delayed;
      }
      const score = product / Math.sqrt(currentEnergy * delayedEnergy || 1);
      if (score > bestScore) {
        bestLag = lag;
        bestScore = score;
      }
    }
    return bestLag ? Math.round(ENVELOPE_RATE * 60 / bestLag) : null;
  }

  window.JuaTempo = { estimateTempo };
})();