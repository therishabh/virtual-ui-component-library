import axios from 'axios';
import { env } from '../config/env.js'; // ESM me relative import pe `.js` extension zaroori hai
import { logger } from '../config/logger.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// messages: [{ role: 'system' | 'user' | 'assistant', content: '...' }]
// Return: model ka JSON response (parsed object)
export const askAI = async (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('askAI: messages ek non-empty array hona chahiye');
    }

    try {
        // axios.post(url, body, config) -> headers teesre argument (config) me jate hain, body ke andar nahi
        const response = await axios.post(
            OPENROUTER_URL,
            {
                model: 'deepseek/deepseek-chat',
                messages,
                temperature: 0.7,
                max_tokens: 4000, // 2000 me bada component beech me cut ho jata tha, aur JSON.parse fail hota
                response_format: { type: 'json_object' },
            },
            {
                headers: {
                    Authorization: `Bearer ${env.OPEN_API_KEY}`,
                    'X-OpenRouter-Title': 'Virtual UI',
                    'Content-Type': 'application/json',
                },
                timeout: 30_000, // AI call atak jaye to request hang na ho
            },
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('OpenRouter ne empty response diya');
        }

        // json_object mode me content string hota hai, isliye parse karke object return karte hain
        return JSON.parse(content);
    } catch (error) {
        // Error swallow mat karo (pehle catch khali tha), log karke caller ko bhi batao
        logger.error({ err: error, apiError: error.response?.data }, 'OpenRouter request fail hui');
        throw error;
    }
};
