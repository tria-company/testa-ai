export function startTimer() {
  return Date.now();
}

export function elapsed(startTime) {
  return Date.now() - startTime;
}
