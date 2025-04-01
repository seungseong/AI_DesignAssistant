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
        prompt = `${character || '이 사람'} (SNS 링크: ${snsLink})`;
      }
  
      const completion = await withRetry(() => openai.chat.completions.create({
        model: "gpt-4o",
        messages: [        
          {
            role: "system",
            content: "당신은 개인을 분석하고 그 분석을 바탕으로 그들의 성격에 맞는 패션 아이템 디자인을 제공하는 전문가입니다. SNS 링크가 제공된 경우, 그 사람의 소셜 미디어 존재감과 스타일을 분석에 고려하세요."
          },
          {
            role: "user",
            content: `다음 사람을 분석하고 그들의 성격에 맞는 패션 아이템 디자인을 제공해주세요. 캐릭터에 대한 설명은 생략하세요. 그들의 성격을 반영하는 색상, 패턴, 스타일 요소에 대한 구체적인 세부 정보를 포함해주세요. 특정 아이템을 명시하지 마세요. 안전 시스템에 의한 거부를 피하기 위해 민감한, 정치적인, 성적으로 노골적인, 또는 폭력적인 내용을 포함하지 마세요: ${prompt}`
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
  return `깨끗한 흰색 또는 연한 회색 배경에 인물에 어울리는 ${itemType}를 생성하세요. ${specificPrompt} 이것은 ${itemType}여야 하며, 다른 아이템이 아니어야 합니다. 사람 모델이나 마네킹을 포함하지 마세요.`;
}

function getItemPrompt(itemType: string): string {
  const itemPrompts: { [key: string]: string } = {
    't-shirt': '티셔츠의 정면 뷰를 보여주세요, 디자인이 중앙에 위치하도록 평평하게 배치하세요.',
    'tshirt': '티셔츠의 정면 뷰를 보여주세요, 디자인이 중앙에 위치하도록 평평하게 배치하세요.',
    '티셔츠': '티셔츠의 정면 뷰를 보여주세요, 디자인이 중앙에 위치하도록 평평하게 배치하세요.',
    'hoodie': '후드티의 정면 뷰를 보여주세요, 디자인이 중앙에 위치하도록 평평하게 배치하세요.',
    '후드티': '후드티의 정면 뷰를 보여주세요, 디자인이 중앙에 위치하도록 평평하게 배치하세요.',
    '후드': '후드티의 정면 뷰를 보여주세요, 디자인이 중앙에 위치하도록 평평하게 배치하세요.',
    'mug': '패턴이 머그컵 주변을 감싸도록 디자인하세요. 커피/차 머그컵을 보여주세요.',
    '머그컵': '패턴이 머그컵 주변을 감싸도록 디자인하세요. 커피/차 머그컵을 보여주세요.',
    '컵': '패턴이 머그컵 주변을 감싸도록 디자인하세요. 커피/차 머그컵을 보여주세요.',
    'soccer-shoes': '측면에서 본 축구화를 보여주세요. 축구 클리트/축구 부츠를 보여주세요.',
    'soccer shoes': '측면에서 본 축구화를 보여주세요. 축구 클리트/축구 부츠를 보여주세요.',
    '축구화': '측면에서 본 축구화를 보여주세요. 축구 클리트/축구 부츠를 보여주세요.',
    'backpack': '독특한 패턴으로 디자인하세요. 백팩을 보여주세요.',
    '백팩': '독특한 패턴으로 디자인하세요. 백팩을 보여주세요.',
    '가방': '독특한 패턴으로 디자인하세요. 백팩을 보여주세요.',
    'cap': '앞면에 패턴이 있는 디자인을 만드세요. 캡/모자를 보여주세요.',
    '모자': '앞면에 패턴이 있는 디자인을 만드세요. 캡/모자를 보여주세요.',
    '캡': '앞면에 패턴이 있는 디자인을 만드세요. 캡/모자를 보여주세요.',
    'shoes': '측면에서 본 신발을 보여주세요. 정장 구두나 운동화가 아닌 캐주얼 신발을 보여주세요.',
    '신발': '측면에서 본 신발을 보여주세요. 정장 구두나 운동화가 아닌 캐주얼 신발을 보여주세요.',
  };

  const normalizedType = itemType.toLowerCase();
  const specificPrompt = itemPrompts[normalizedType];
  console.log('itemType:', itemType);
  console.log('normalizedType:', normalizedType);
  console.log('specificPrompt:', specificPrompt);
  if (specificPrompt) {
    return formatProductPrompt(normalizedType, specificPrompt);
  }
  
  // 기본 프롬프트
  return formatProductPrompt(itemType, `아이템의 정면 뷰를 보여주고, 디자인이 명확하게 보이도록 평평하게 배치하세요.`);
}

// 공통 프롬프트 생성 함수
export function createImagePrompt(analysis: string, itemType: string): string {
  // 아이템 유형별 프롬프트 가져오기
  const itemPrompt = getItemPrompt(itemType);
  console.log('itemPrompt:', itemPrompt);
  
  // 명확하고 안전한 프롬프트로 구성
  return `${itemPrompt} 다음 스타일 요소에서 영감을 받았습니다: ${analysis}. 깨끗한 흰색 또는 연한 회색 배경의 전문적인 제품 사진을 만드세요. 디자인은 깔끔하고 상업적으로 적합해야 합니다. 사람 모델, 마네킹 또는 추가 소품을 포함하지 마세요.`;
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