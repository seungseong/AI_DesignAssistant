import OpenAI from 'openai';
const { GoogleGenAI } = require("@google/genai");
import axios from 'axios';
//const fs = require("fs");

// API 키 확인
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('OpenAI API key is not configured. Please check your .env.local file');
  throw new Error('OpenAI API 키가 설정되지 않았습니다. .env.local 파일을 확인해주세요.');
}

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Gemini API key is not configured. Please check your .env.local file');
  throw new Error('Gemini API 키가 설정되지 않았습니다. .env.local 파일을 확인해주세요.');
}

let openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

let geminiAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// OpenAI 클라이언트 재초기화 함수
export function resetOpenAIClient() {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });

  geminiAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// 재시도를 위한 지연 함수
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// API 요청 재시도 래퍼 함수
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  retryDelay = 1000,
  retryMultiplier = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // 남은 재시도 횟수 확인
    if (retries <= 0) throw error;

    // 안전 정책 위반 오류는 재시도하지 않음 (오류 메시지 패턴 확장)
    if ((error.status === 400 && error.message?.includes('safety')) || 
        error.message?.includes('Safety system rejection') ||
        error.message?.includes('content policy') ||
        error.message?.includes('blocked')) {
      console.error('Safety system rejection, not retrying');
      throw error;
    }

    // 에러가 Rate Limit 관련인지 확인
    const isRateLimit = error.status === 429 || 
                       (error.response && error.response.status === 429) ||
                       error.message?.includes('rate limit') ||
                       error.message?.includes('too many requests');

    if (isRateLimit) {
      console.log(`Rate limit hit, retrying after ${retryDelay}ms...`);
      await delay(retryDelay);
      return withRetry(fn, retries - 1, retryDelay * retryMultiplier, retryMultiplier);
    }

    // 일반적인 서버 오류는 재시도
    const isServerError = error.status >= 500 || 
                         (error.response && error.response.status >= 500);
    
    if (isServerError) {
      console.log(`Server error, retrying after ${retryDelay}ms...`);
      await delay(retryDelay);
      return withRetry(fn, retries - 1, retryDelay * retryMultiplier, retryMultiplier);
    }

    // 그 외 오류는 즉시 발생
    throw error;
  }
}

// 에러 메시지 포맷팅 함수
function formatErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  
  // OpenAI 에러
  if (error.message) {
    if (error.message.includes('rate limit')) {
      return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    }
    if (error.message.includes('insufficient_quota')) {
      return 'API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.';
    }
    if (error.message.includes('content_policy_violation')) {
      return '요청하신 내용이 콘텐츠 정책에 위배됩니다. 다른 내용으로 시도해주세요.';
    }
    return error.message;
  }

  return '알 수 없는 오류가 발생했습니다.';
}

// 인물 분석을 위한 함수
export async function analyzeCharacter(character: string, snsLink?: string): Promise<string> {
    try {
      let prompt = character;
      if (snsLink) {
        prompt = `${character || 'This person'} (SNS Link: ${snsLink})`;
      }
  
      const completion = await withRetry(() => openai.chat.completions.create({
        model: "gpt-4o",
        messages: [        
          {
            role: "system",
            content: "You are an expert who analyzes individuals and provides fashion item designs that match their personality based on the analysis. If an SNS link is provided, consider the person's social media presence and style in your analysis."
          },
          {
            role: "user",
            content: `Analyze the following individuals to omit descriptions of the characters and provide fashion item designs that fit your personality. Include specific details about the color, pattern, and style elements that reflect your personality. Do not specify items at this time: ${prompt}`
          }
        ],
      }));
  
      return completion.choices[0].message.content || '';
    } catch (error) {
      console.error('Error analyzing character:', error);
      throw new Error(formatErrorMessage(error));
    }
  }

// 공통 프롬프트 포맷 함수 추가
function formatProductPrompt(itemType: string, specificPrompt: string): string {
  return `Create a professional product image featuring only the ${itemType}, with a clean white or light gray background. ${specificPrompt} This must be ${itemType === 'logo' ? 'a' : 'the'} ${itemType}, not any other ${itemType === 'logo' ? 'design' : 'item'}. Do not include any human models or mannequins.`;
}

function getItemPrompt(itemType: string): string {
  const itemPrompts: { [key: string]: string } = {
    'logo': 'Create a modern and minimalist logo design.',
    't-shirt': 'Show a single front view of the t-shirt, laid flat with the design centered.',
    'tshirt': 'Show a single front view of the t-shirt, laid flat with the design centered.',
    '티셔츠': 'Show a single front view of the t-shirt, laid flat with the design centered.',
    'hoodie': 'Show a single front view of the hoodie, laid flat with the design centered.',
    '후드티': 'Show a single front view of the hoodie, laid flat with the design centered.',
    '후드': 'Show a single front view of the hoodie, laid flat with the design centered.',
    'mug': 'Design with the pattern wrapped around. Show a coffee/tea mug.',
    '머그컵': 'Design with the pattern wrapped around. Show a coffee/tea mug.',
    '컵': 'Design with the pattern wrapped around. Show a coffee/tea mug.',
    'soccer-shoes': 'Show the shoe from side view. Show soccer cleats/football boots.',
    'soccer shoes': 'Show the shoe from side view. Show soccer cleats/football boots.',
    '축구화': 'Show the shoe from side view. Show soccer cleats/football boots.',
    'backpack': 'Design with a unique pattern. Show a backpack.',
    '백팩': 'Design with a unique pattern. Show a backpack.',
    '가방': 'Design with a unique pattern. Show a backpack.',
    'cap': 'Design with a pattern on the front. Show a cap/hat.',
    '모자': 'Design with a pattern on the front. Show a cap/hat.',
    '캡': 'Design with a pattern on the front. Show a cap/hat.',
    'shoes': 'Show the shoes from side view. Show casual shoes, not formal shoes or athletic footwear.',
    '신발': 'Show the shoes from side view. Show casual shoes, not formal shoes or athletic footwear.',
  };

  const normalizedType = itemType.toLowerCase();
  const specificPrompt = itemPrompts[normalizedType];
  
  if (specificPrompt) {
    return formatProductPrompt(normalizedType, specificPrompt);
  }
  
  // 기본 프롬프트
  return formatProductPrompt(itemType, `Show a single front view of the item, laid flat with the design clearly visible.`);
}

// 공통 프롬프트 생성 함수
export function createImagePrompt(analysis: string, itemType: string): string {
  // 아이템 유형별 프롬프트 가져오기
  const itemPrompt = getItemPrompt(itemType);
  
  // 명확하고 안전한 프롬프트로 구성
  return `${itemPrompt} inspired by these style elements: ${analysis}. Create a professional product photo with a clean white or light gray background. The design should be neat and commercially suitable. Do not include any human models, mannequins, or additional props.`;
}

// DALL-E 이미지 생성 함수
export async function generateDalleImage(prompt: string): Promise<string> {
  try {
    console.log("DALL-E 생성 요청 프롬프트:", prompt.substring(0, 100) + "...");

    const response = await withRetry(() => openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      style: "natural", // 중립적인 스타일 선택
    }));

    console.log("DALL-E 이미지 생성 성공");
    return response.data[0].url || '';
  } catch (error: any) {
    console.error('Error generating image:', error);    
    // 기타 오류인 경우 직접 오류 메시지 전달
    throw new Error(formatErrorMessage(error));
  }
}

// Gemini를 사용한 이미지 생성 함수
export async function generateGeminiImage(prompt: string): Promise<string> {
  try {    
    console.log("Gemini 생성 요청 프롬프트:", prompt.substring(0, 100) + "...");
    
    // Set responseModalities to include "Image" so the model can generate an image
    const response = await geminiAI.models.generateContent({
      model: 'gemini-2.0-flash-exp-image-generation',
      contents: prompt,
      config: {
        responseModalities: ['Text', 'Image']
      },
    });
    
    // 이미지 URL을 저장할 변수
    let imageUrl = '';
    
    for (const part of response.candidates[0].content.parts) {
      // Based on the part type, either show the text or save the image
      if (part.text) {
        console.log(part.text);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        // Base64 이미지 데이터를 URL로 변환
        imageUrl = `data:${part.inlineData.mimeType};base64,${imageData}`;
        console.log('Gemini image generated successfully');
        break;
      }
    }
    
    return imageUrl || 'https://placehold.co/1024x1024/f5f5f5/cccccc?text=Gemini+Image+Generation+Failed';
  } catch (error) {
    console.error("Error generating Gemini content:", error);
    
    // 플레이스홀더 반환
    return 'https://placehold.co/1024x1024/f5f5f5/cccccc?text=Gemini+Image+Generation+Failed';
  }
}

/* 기존 코드
import axios from 'axios'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Add error checking for API key
if (!OPENAI_API_KEY) {
  throw new Error('OpenAI API key is not configured')
}

const axiosInstance = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  }
})

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function generateDesign(userInput: string, retries = 1) {
  try {
    const formattedPrompt = `Create a merchandise design based on these preferences: ${userInput}. Make it suitable for products like t-shirts, mugs, or posters.`
    
    const response = await axiosInstance.post('/images/generations', {
      model: 'dall-e-3',
      prompt: formattedPrompt,
      n: 1,
      size: '1024x1024',
      quality: "standard"
    })
    return response.data.data[0].url
  } catch (error: any) {
    if (error.response?.status === 429 && retries > 0) {
      await delay(1000)
      return generateDesign(userInput, retries - 1)
    }
    
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    })

    if (error.response?.status === 429) {
      throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')
    }
    
    // 구체적인 에러 메시지 전달
    const errorMessage = error.response?.data?.error?.message || error.message || '알 수 없는 오류가 발생했습니다.'
    throw new Error(errorMessage)
  }
}
*/