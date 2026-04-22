const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function translateAudioWithGemini(
  audioBlob: Blob,
  targetLanguage: string
): Promise<string> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if(!apiKey) {
    throw new Error('Missing VITE_GEMINI_API_KEY');
  }

  const base64 = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type || 'audio/ogg';

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      contents: [{
        parts: [
          {text: `Transcribe this audio and translate it into ${targetLanguage}. Return only the translated text.`},
          {inline_data: {mime_type: mimeType, data: base64}}
        ]
      }]
    })
  });

  if(!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if(!text) {
    throw new Error('Gemini returned no text');
  }
  return text.trim();
}
