import { env } from "./env";

// Define a function to initialize arcjet
export async function initArcjet() {
  // Dynamically import arcjet
  const arcjetModule = await import('@arcjet/node');
  const arcjet = arcjetModule.default;
  const { shield, detectBot, tokenBucket } = arcjetModule;

  console.log('Arcjet imported successfully, initializing with key...');
  
  // Log the first few characters of the key for debugging (never log the full key)
  const keyPrefix = env.ARCJET_KEY?.substring(0, 4);
  console.log(`Using Arcjet key starting with: ${keyPrefix}...`);

  try {
    const aj = arcjet({
      key: env.ARCJET_KEY,
      characteristics: ["ip.src"],
      rules: [
        shield({ mode: "LIVE" }),
        detectBot({
          mode: "LIVE",
          allow: ["CATEGORY:SEARCH_ENGINE"],
        }),
        tokenBucket({
          mode: "LIVE",
          refillRate: 5,
          interval: 10,
          capacity: 10,
        }),
      ],
    });

    console.log('Arcjet instance created successfully');
    return aj;
  } catch (error) {
    console.error('Error initializing Arcjet:', error);
    throw error;
  }
}