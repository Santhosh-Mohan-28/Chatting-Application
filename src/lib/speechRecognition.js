let recognition = null;

export function isSpeechRecognitionSupported() {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

export function createSpeechRecognition({
  onResult,
  onStart,
  onEnd,
  onError,
} = {}) {
  if (!isSpeechRecognitionSupported()) {
    return null;
  }

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  recognition = new SpeechRecognition();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    onStart?.();
  };

  recognition.onresult = (event) => {
    let transcript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }

    const isFinal = event.results[event.results.length - 1].isFinal;

    onResult?.({
      text: transcript.trim(),
      isFinal,
    });
  };

  recognition.onend = () => {
    onEnd?.();
  };

  recognition.onerror = (event) => {
    onError?.(event.error);
  };

  return recognition;
}

export function startSpeechRecognition() {
  if (recognition) {
    try {
      recognition.start();
    } catch (error) {
      // Recognition may already be running.
    }
  }
}

export function stopSpeechRecognition() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      // Recognition may already be stopped.
    }
  }
}

export function destroySpeechRecognition() {
  if (recognition) {
    try {
      recognition.abort();
    } catch (error) {
      // Recognition may already be stopped.
    }

    recognition = null;
  }
}