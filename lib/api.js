// lib/api.js
const axios = require('axios');
const FormData = require('form-data');

class APIError extends Error {
    constructor(message, code, originalError = null) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.originalError = originalError;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * External API Call Manager
 * Centralized API calls for all functions
 */
class APIManager {
    constructor() {
        this.config = {
            timeout: 30000,
            maxRetries: 3,
            retryDelay: 1000
        };
        
        // API endpoints configuration
        this.endpoints = {
            // AI Services
            openai: {
                baseURL: 'https://api.openai.com/v1',
                headers: () => ({
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                })
            },
            google: {
                baseURL: 'https://www.googleapis.com',
                headers: () => ({
                    'Authorization': `Bearer ${process.env.GOOGLE_API_KEY}`,
                    'Content-Type': 'application/json'
                })
            },
            elevenlabs: {
                baseURL: 'https://api.elevenlabs.io/v1',
                headers: () => ({
                    'xi-api-key': process.env.ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                })
            },
            // Translation
            libretranslate: {
                baseURL: 'https://libretranslate.com',
                headers: () => ({
                    'Content-Type': 'application/json'
                })
            },
            // Weather
            openweather: {
                baseURL: 'https://api.openweathermap.org/data/2.5',
                params: () => ({
                    appid: process.env.OPENWEATHER_API_KEY,
                    units: 'metric'
                })
            },
            // Currency
            exchangerate: {
                baseURL: 'https://api.exchangerate.host',
                headers: () => ({
                    'Content-Type': 'application/json'
                })
            },
            // Bible/Religious
            bibleapi: {
                baseURL: 'https://bible-api.com',
                headers: () => ({
                    'Content-Type': 'application/json'
                })
            },
            // Media Download APIs
            youtube: {
                baseURL: 'https://www.googleapis.com/youtube/v3',
                headers: () => ({
                    'Authorization': `Bearer ${process.env.YOUTUBE_API_KEY}`,
                    'Content-Type': 'application/json'
                })
            },
            instagram: {
                baseURL: 'https://www.instagram.com',
                headers: () => ({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
            },
            tiktok: {
                baseURL: 'https://www.tiktok.com',
                headers: () => ({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
            }
        };
    }

    /**
     * Make API call with retry logic
     */
    async call(service, endpoint, method = 'GET', data = null, customHeaders = {}) {
        const config = this.endpoints[service];
        if (!config) {
            throw new APIError(`Unknown API service: ${service}`, 'UNKNOWN_SERVICE');
        }

        let retries = this.config.maxRetries;
        
        while (retries >= 0) {
            try {
                const requestConfig = {
                    method,
                    url: endpoint.startsWith('http') ? endpoint : `${config.baseURL}${endpoint}`,
                    headers: { ...config.headers(), ...customHeaders },
                    timeout: this.config.timeout
                };

                // Add query params for GET requests
                if (method === 'GET' && config.params) {
                    requestConfig.params = config.params();
                }

                // Add data for POST/PUT/PATCH
                if (['POST', 'PUT', 'PATCH'].includes(method) && data) {
                    if (data instanceof FormData) {
                        requestConfig.data = data;
                        requestConfig.headers = {
                            ...requestConfig.headers,
                            ...data.getHeaders()
                        };
                    } else {
                        requestConfig.data = data;
                    }
                }

                const response = await axios(requestConfig);
                return response.data;
                
            } catch (error) {
                if (retries === 0) {
                    throw new APIError(
                        `API call failed after ${this.config.maxRetries} retries: ${error.message}`,
                        'API_CALL_FAILED',
                        error
                    );
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
                retries--;
            }
        }
    }

    /**
     * OpenAI GPT call
     */
    async callGPT(prompt, model = 'gpt-3.5-turbo', temperature = 0.7) {
        try {
            const response = await this.call('openai', '/chat/completions', 'POST', {
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature,
                max_tokens: 1000
            });
            
            return response.choices[0]?.message?.content || '';
        } catch (error) {
            throw new APIError(`GPT call failed: ${error.message}`, 'GPT_ERROR', error);
        }
    }

    /**
     * Google Search
     */
    async googleSearch(query, maxResults = 10) {
        try {
            const response = await this.call('google', '/customsearch/v1', 'GET', null, {
                params: {
                    q: query,
                    key: process.env.GOOGLE_API_KEY,
                    cx: process.env.GOOGLE_CSE_ID,
                    num: maxResults
                }
            });
            
            return response.items || [];
        } catch (error) {
            throw new APIError(`Google search failed: ${error.message}`, 'GOOGLE_SEARCH_ERROR', error);
        }
    }

    /**
     * Text to Speech (ElevenLabs)
     */
    async textToSpeech(text, voiceId = '21m00Tcm4TlvDq8ikWAM') {
        try {
            const response = await this.call('elevenlabs', `/text-to-speech/${voiceId}`, 'POST', {
                text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5
                }
            });
            
            return response.audio; // Base64 encoded audio
        } catch (error) {
            throw new APIError(`TTS failed: ${error.message}`, 'TTS_ERROR', error);
        }
    }

    /**
     * Translate text
     */
    async translateText(text, targetLang, sourceLang = 'auto') {
        try {
            const response = await this.call('libretranslate', '/translate', 'POST', {
                q: text,
                source: sourceLang,
                target: targetLang,
                format: 'text',
                api_key: process.env.LIBRETRANSLATE_API_KEY || ''
            });
            
            return {
                original: text,
                translated: response.translatedText,
                source: response.detectedLanguage?.language || sourceLang,
                target: targetLang
            };
        } catch (error) {
            throw new APIError(`Translation failed: ${error.message}`, 'TRANSLATION_ERROR', error);
        }
    }

    /**
     * Get weather data
     */
    async getWeather(location, units = 'metric') {
        try {
            const response = await this.call('openweather', '/weather', 'GET', null, {
                params: {
                    q: location,
                    units,
                    appid: process.env.OPENWEATHER_API_KEY
                }
            });
            
            return {
                location: response.name,
                country: response.sys?.country,
                temperature: response.main?.temp,
                feelsLike: response.main?.feels_like,
                humidity: response.main?.humidity,
                pressure: response.main?.pressure,
                description: response.weather[0]?.description,
                icon: response.weather[0]?.icon,
                windSpeed: response.wind?.speed,
                windDirection: response.wind?.deg,
                visibility: response.visibility,
                sunrise: response.sys?.sunrise,
                sunset: response.sys?.sunset
            };
        } catch (error) {
            throw new APIError(`Weather API failed: ${error.message}`, 'WEATHER_ERROR', error);
        }
    }

    /**
     * Currency conversion
     */
    async convertCurrency(amount, from, to) {
        try {
            const response = await this.call('exchangerate', '/convert', 'GET', null, {
                params: {
                    from,
                    to,
                    amount,
                    places: 4
                }
            });
            
            return {
                original: amount,
                converted: response.result,
                rate: response.info?.rate,
                from,
                to,
                date: response.date
            };
        } catch (error) {
            throw new APIError(`Currency conversion failed: ${error.message}`, 'CURRENCY_ERROR', error);
        }
    }

    /**
     * Download media from URL
     */
    async downloadMedia(url, responseType = 'arraybuffer') {
        try {
            const response = await axios({
                method: 'GET',
                url,
                responseType,
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            return {
                buffer: Buffer.from(response.data),
                contentType: response.headers['content-type'],
                contentLength: response.headers['content-length'],
                filename: this.extractFilename(url, response.headers)
            };
        } catch (error) {
            throw new APIError(`Download failed: ${error.message}`, 'DOWNLOAD_ERROR', error);
        }
    }

    /**
     * Extract filename from URL or headers
     */
    extractFilename(url, headers) {
        // Try from Content-Disposition header
        const disposition = headers['content-disposition'];
        if (disposition) {
            const matches = disposition.match(/filename="?(.+?)"?$/);
            if (matches) return matches[1];
        }
        
        // Try from URL
        const urlParts = url.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        const cleanName = lastPart.split('?')[0];
        
        // Add extension if missing
        if (!cleanName.includes('.')) {
            const contentType = headers['content-type'];
            if (contentType) {
                const ext = contentType.split('/')[1];
                return `${cleanName}.${ext}`;
            }
        }
        
        return cleanName || 'download';
    }

    /**
     * Get Bible verse
     */
    async getBibleVerse(reference, translation = 'kjv') {
        try {
            const response = await this.call('bibleapi', `/${reference}?translation=${translation}`);
            
            return {
                reference: response.reference,
                translation: response.translation_name,
                text: response.text,
                verses: response.verses,
                chapter: response.chapter,
                book: response.book_name
            };
        } catch (error) {
            throw new APIError(`Bible API failed: ${error.message}`, 'BIBLE_ERROR', error);
        }
    }

    /**
     * Get joke
     */
    async getJoke(category = 'any') {
        try {
            const response = await axios.get(
                `https://v2.jokeapi.dev/joke/${category}?safe-mode`
            );
            
            return {
                category: response.data.category,
                type: response.data.type,
                joke: response.data.type === 'single' 
                    ? response.data.joke 
                    : `${response.data.setup} ... ${response.data.delivery}`,
                flags: response.data.flags,
                id: response.data.id
            };
        } catch (error) {
            throw new APIError(`Joke API failed: ${error.message}`, 'JOKE_ERROR', error);
        }
    }

    /**
     * Get advice
     */
    async getAdvice() {
        try {
            const response = await axios.get('https://api.adviceslip.com/advice');
            return {
                advice: response.data.slip.advice,
                id: response.data.slip.id
            };
        } catch (error) {
            throw new APIError(`Advice API failed: ${error.message}`, 'ADVICE_ERROR', error);
        }
    }

    /**
     * Get quote
     */
    async getQuote(category = 'inspirational') {
        try {
            const response = await axios.get('https://api.quotable.io/random', {
                params: { tags: category }
            });
            
            return {
                content: response.data.content,
                author: response.data.author,
                tags: response.data.tags,
                length: response.data.length
            };
        } catch (error) {
            throw new APIError(`Quote API failed: ${error.message}`, 'QUOTE_ERROR', error);
        }
    }
}

// Export singleton instance
module.exports = new APIManager();
