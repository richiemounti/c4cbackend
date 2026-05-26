// services/googleTranslate.service.ts
import { Translate } from '@google-cloud/translate/build/src/v2';

const translate = new Translate({
  key: process.env.GOOGLE_TRANSLATE_API_KEY
});

export const translateText = async (
  text: string,
  targetLanguage: string,
  sourceLanguage: string = 'en'
): Promise<string> => {
  if (!text?.trim()) return text;
  
  try {
    const [translation] = await translate.translate(text, {
      from: sourceLanguage,
      to: targetLanguage
    });
    return translation;
  } catch (error) {
    console.error(`Translation failed for text: "${text.substring(0, 50)}..."`, error);
    throw new Error(`Google Translate failed: ${(error as Error).message}`);
  }
};

export const translateBatch = async (
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string = 'en'
): Promise<string[]> => {
  if (!texts.length) return [];
  
  // Google Translate supports batch requests - filter out empty strings
  const nonEmpty = texts.map((t, i) => ({ text: t, index: i })).filter(t => t.text?.trim());
  
  if (!nonEmpty.length) return texts;

  const [translations] = await translate.translate(
    nonEmpty.map(t => t.text),
    { from: sourceLanguage, to: targetLanguage }
  );

  // Map back to original positions
  const result = [...texts];
  nonEmpty.forEach((item, i) => {
    result[item.index] = Array.isArray(translations) ? translations[i] : translations;
  });
  
  return result;
};