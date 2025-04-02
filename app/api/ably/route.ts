import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

// 상품 타입 정의
export interface ShopItem {
  id: string;
  image: string;
  title: string;
  price: string;
  url: string;
  brand?: string;
  rank?: number;
  category?: string;
}

// 에이블리 카테고리 코드 정의
interface AblyCategoryOption {
  category_sno: number;
  sub_category_sno: number;
}

interface AblyCategory {
  category_sno: number;
  subcategories?: { [key: string]: AblyCategoryOption };
  sub_category_sno?: number;
}

interface AblyCategoryStructure {
  [key: string]: AblyCategoryOption | AblyCategory;
}

const ABLY_CATEGORIES: AblyCategoryStructure = {
  '전체': { 
    category_sno: 0, 
    sub_category_sno: 0
  },
  '상의': {
    category_sno: 8,
    subcategories: {
      '전체': { category_sno: 8, sub_category_sno: 0 },
      '반소매 티셔츠': { category_sno: 8, sub_category_sno: 18 },
      '민소매 티셔츠': { category_sno: 8, sub_category_sno: 21 },
      '니트/스웨터': { category_sno: 8, sub_category_sno: 299 },
      '맨투맨/스웨트셔츠': { category_sno: 8, sub_category_sno: 300 },
      '긴소매 티셔츠': { category_sno: 8, sub_category_sno: 498 },
      '셔츠/블라우스': { category_sno: 8, sub_category_sno: 499 },
      '후드 티셔츠': { category_sno: 8, sub_category_sno: 500 }
    }
  },
  '바지': {
    category_sno: 174,
    subcategories: {
      '전체': { category_sno: 174, sub_category_sno: 0 }
    }
  },
  '아우터': {
    category_sno: 7,
    subcategories: {
      '전체': { category_sno: 7, sub_category_sno: 0 },
      '재킷': { category_sno: 7, sub_category_sno: 293 },
      '가디건': { category_sno: 7, sub_category_sno: 16 },
      '슈트': { category_sno: 7, sub_category_sno: 3 },
      '코트': { category_sno: 7, sub_category_sno: 296 },
      '베스트': { category_sno: 7, sub_category_sno: 297 },
      '패딩': { category_sno: 7, sub_category_sno: 297 },
      '무스탕': { category_sno: 7, sub_category_sno: 6 },
      '플리스/후리스': { category_sno: 7, sub_category_sno: 577 }
    }
  },
  '원피스': {
    category_sno: 10,
    subcategories: {
      '전체': { category_sno: 10, sub_category_sno: 0 }
    }
  },
};

const productItemClass = '.sc-b3c10446-0.fLZaoW.sc-2efdd3c6-0.iGHAmn';
const productImageClass = '.sc-ecca1885-3.fQtenw.sc-5b700d3e-0.jTuGWe';
const productPriceClass = '.sc-cc3fb985-0.jcHbjU';
const productBrandClass = 'p.typography.typography__subtitle4.typography__ellipsis.color__gray60.sc-28d3dfe7-0.fMJBVC';
const productTitleClass = 'p.typography.typography__body4.typography__ellipsis.color__gray60';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const category = searchParams.get('category') || '';
  
  // 카테고리 문자열에서 옵션 가져오기
  const categoryOption = getCategoryOption(category);
  const category_sno = categoryOption.category_sno.toString();
  const sub_category_sno = categoryOption.sub_category_sno.toString();

  if (!keyword && (!category_sno || category_sno === '0') && category === '') {
    return NextResponse.json({ error: 'Keyword or category is required' }, { status: 400 });
  }

  try {
    let items: ShopItem[] = [];

    // 카테고리 코드로 스크래핑
    if (category_sno && category_sno !== '0') {
      // next_token은 고정된 값으로 설정 (실제로는 요청마다 새로 생성되어야 함)
      const next_token = 'eyJsIjogMSwgInAiOiB7ImRlcGFydG1lbnRfdHlwZSI6ICJDQVRFR09SWSIsICJjYXRlZ29yeV9zbm8iOiA4LCAicHJldmlvdXNfc2NyZWVuX25hbWUiOiAiQ0FURUdPUllfREVQQVJUTUVOVCIsICJmaWx0ZXJfY29tcG9uZW50IjogNjN9LCAiY2F0ZWdvcnlfc25vIjogOH0%3D';
      const ablyLink = 'https://m.a-bly.com/screens?screen_name=COMPONENT_LIST';
      let rankingUrl = `${ablyLink}&next_token=${next_token}&category_sno=${category_sno}&sub_category_sno=${sub_category_sno}`;

      // Puppeteer를 사용하여 동적 페이지 로딩
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      try {
        const page = await browser.newPage();
        
        // User-Agent 설정
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1');
        
        // 페이지 로딩
        await page.goto(rankingUrl, { waitUntil: 'networkidle2', timeout: 10000 });
        //console.log('ably rankingUrl:', rankingUrl);
        
        // 페이지가 로드되면 HTML 콘텐츠 가져오기
        const content = await page.content();
        const $ = cheerio.load(content);
        
        // 에이블리 HTML 구조에 맞게 상품 추출
        // 상품 찾기
        const productItems = $(`${productItemClass}`);
        
        productItems.slice(0, 3).each((i, el) => {
          const rank = i + 1;

          // 이미지 찾기 - 특정 클래스 내에서만 찾기
          const mainImageEl = $(el).find(`${productImageClass}`);
          const imageEl = mainImageEl.find('img');
          let image = imageEl.attr('src') || imageEl.attr('data-src') || '';

          // 이미지가 없으면 다른 이미지 요소 찾기 시도
          if (!image) {
            const altImageEl = $(el).find('img').first();
            image = altImageEl.attr('src') || altImageEl.attr('data-src') || '';
          }

          // 이미지가 여전히 없으면 기본 이미지 사용
          if (!image) {
            image = 'https://image.a-bly.com/images/no_image.jpg';
          }
          
          // 브랜드명과 상품명이 있는 컨테이너 찾기
          //const infoContainer = $(el).find(`${productInfoClass}`);

          // 브랜드명 찾기 (p 태그)
          const brandEl = $(el).find(`${productBrandClass}`);
          const brand = brandEl.text().trim();

          // 상품명 찾기 (p 태그)
          const titleEl = $(el).find(`${productTitleClass}`);
          const title = titleEl.text().trim();

          // 가격 찾기
          const priceEl = $(el).find(`${productPriceClass}`);
          const price = priceEl.text().trim().replace(/^.*%/, '') + '원';
          
          // 링크 요소 찾기 (부모 요소가 링크일 수 있음)
          const linkEl = $(el).closest('a');
          let link = linkEl.attr('href') || '';
          if (link && !link.startsWith('http')) {
            link = `https://m.a-bly.com${link}`;
          }
          
          // 상품 ID 추출 (URL에서)
          const matches = link.match(/\/products\/(\d+)/);
          const itemId = matches ? matches[1] : `${i+1}`;
          
          // 상품 정보 완성
          const item: ShopItem = {
            id: `ably-${itemId}`,
            rank,
            image: image || 'https://image.a-bly.com/images/no_image.jpg',
            title: title || '에이블리 상품',
            price: price || '가격정보 없음',
            url: link || 'https://m.a-bly.com',
            brand: brand || '브랜드 정보 없음',
          };
          
          items.push(item);
        });
        
        await browser.close();
      } catch (error) {
        console.error('Puppeteer 처리 오류:', error);
        await browser.close();
        throw error;
      }
    }

    // 키워드 검색
    if (keyword && items.length === 0) {
      //https://m.a-bly.com/search?screen_name=SEARCH_RESULT&keyword=%EA%B8%B4%EC%86%8C%EB%A7%A4%ED%8B%B0%EC%85%94%EC%B8%A0&search_type=DIRECT
      const searchUrl = `https://m.a-bly.com/search?keyword=${encodeURIComponent(keyword)}`;
      
      // Puppeteer로 검색 페이지 크롤링
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      try {
        const page = await browser.newPage();
        
        // User-Agent 설정 (모바일)
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1');
        
        // 페이지 로딩
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 10000 });
        
        // 페이지가 로드되면 HTML 콘텐츠 가져오기
        const content = await page.content();
        const $ = cheerio.load(content);
        
        // 검색 결과에서 상품 항목 추출
        const productItems = $('.sc-b3c10446-0.fLZaoW.sc-2efdd3c6-0.iGHAmn .sc-2efdd3c6-1.jNmUoh');
        
        productItems.slice(0, 3).each((i, el) => {
          const rank = i + 1;
          
          // 이미지 찾기 - 특정 클래스 내에서만 찾기
          const mainImageEl = $(el).find('.sc-ecca1885-3.fQtenw.sc-5b700d3e-0.jTuGWe');
          const imageEl = mainImageEl.find('img');
          let image = imageEl.attr('src') || imageEl.attr('data-src') || '';

          // 이미지가 없으면 다른 이미지 요소 찾기 시도
          if (!image) {
            const altImageEl = $(el).find('img').first();
            image = altImageEl.attr('src') || altImageEl.attr('data-src') || '';
          }

          // 이미지가 여전히 없으면 기본 이미지 사용
          if (!image) {
            image = 'https://image.a-bly.com/images/no_image.jpg';
          }
          
          // 브랜드명과 상품명이 있는 컨테이너 찾기
          const infoContainer = $(el).find('.sc-2efdd3c6-2.ibTWTl');

          // 브랜드명 찾기 (p 태그)
          const brandEl = infoContainer.find('p.typography.typography_subtitle4.typography_ellipsis.color_gгay60');
          const brand = brandEl.text().trim();

          // 상품명 찾기 (p 태그)
          const titleEl = infoContainer.find('p.typography.typography_bodyd.typography_ellipsis.color_gray6o');
          const title = titleEl.text().trim();

          // 가격 찾기
          const priceEl = $(el).find('.sc-cc3fb985-0.jcHbjU');
          const price = (priceEl.text().trim().replace(/^.*%/, '') || '가격정보 없음') + '원';
          
          // 링크 요소 찾기 (부모 요소가 링크일 수 있음)
          const linkEl = $(el).closest('a');
          let link = linkEl.attr('href') || '';
          if (link && !link.startsWith('http')) {
            link = `https://m.a-bly.com${link}`;
          }
          
          // 상품 정보 완성
          const item: ShopItem = {
            id: `ably-${i+1}`,
            rank,
            image: image || 'https://image.a-bly.com/images/no_image.jpg',
            title: title || '에이블리 상품',
            price: price,
            url: link || 'https://m.a-bly.com',
            brand: brand || '브랜드 정보 없음'
          };
          
          items.push(item);
        });
        
        await browser.close();
      } catch (error) {
        console.error('Puppeteer 검색 오류:', error);
        await browser.close();
        throw error;
      }
    }

    // 상품을 찾지 못했다면 더미 데이터 사용
    if (items.length === 0) {
      items = getDummyItems();
    } else if (items.length < 3) {
      // 3개 미만이면 더미 데이터로 채움
      const dummyItems = getDummyItems();
      while (items.length < 3) {
        const dummyIndex = items.length;
        if (dummyItems[dummyIndex]) {
          items.push({
            ...dummyItems[dummyIndex],
            id: `ably-dummy-${items.length + 1}`,
            rank: items.length + 1
          });
        } else {
          break;
        }
      }
    }
    
    return NextResponse.json(items);
    
  } catch (error) {
    console.error('Error scraping Ably:', error);
    
    // 더미 데이터 반환
    const dummyItems = getDummyItems();
    return NextResponse.json(dummyItems);
  }
}

// 더미 데이터 반환 함수
function getDummyItems(): ShopItem[] {
  // 카테고리와 관계없이 빈 이미지를 표시하는 데이터 반환
  return [
    {
      id: 'ably-1',
      rank: 1,
      image: 'https://image.a-bly.com/images/no_image.jpg',
      title: '상품 정보가 없습니다',
      price: '',
      url: 'https://www.a-bly.com',
      brand: '',
    },
    {
      id: 'ably-2',
      rank: 2,
      image: 'https://image.a-bly.com/images/no_image.jpg',
      title: '상품 정보가 없습니다',
      price: '',
      url: 'https://www.a-bly.com',
      brand: '',
    },
    {
      id: 'ably-3',
      rank: 3,
      image: 'https://image.a-bly.com/images/no_image.jpg',
      title: '상품 정보가 없습니다',
      price: '',
      url: 'https://www.a-bly.com',
      brand: '',
    }
  ];
}

// 문자열 카테고리를 에이블리 카테고리 옵션으로 변환
function getCategoryOption(categoryStr: string): { category_sno: number, sub_category_sno: number } {
  // 기본값 (전체)
  if (!categoryStr || categoryStr === '전체') {
    return { category_sno: 0, sub_category_sno: 0 };
  }
  
  // 카테고리가 "상위>하위" 형식인지 확인
  const parts = categoryStr.split('>');
  const mainCategory = parts[0].trim();
  const subCategory = parts.length > 1 ? parts[1].trim() : '전체';
  
  // 메인 카테고리 조회
  if (mainCategory in ABLY_CATEGORIES) {
    const mainCategoryInfo = ABLY_CATEGORIES[mainCategory];
    
    // 메인 카테고리 정보가 객체이고 subcategories 속성을 가지고 있는 경우
    if (typeof mainCategoryInfo === 'object' && 
        'category_sno' in mainCategoryInfo && 
        'subcategories' in mainCategoryInfo && 
        mainCategoryInfo.subcategories) {
          
      // 서브카테고리가 '전체'인 경우
      if (subCategory === '전체' && mainCategoryInfo.subcategories['전체']) {
        return mainCategoryInfo.subcategories['전체'];
      }
      
      // 해당 서브카테고리 찾기
      if (mainCategoryInfo.subcategories && subCategory in mainCategoryInfo.subcategories) {
        return mainCategoryInfo.subcategories[subCategory];
      }
      
      // 서브카테고리를 찾지 못했으면 메인 카테고리의 '전체' 반환
      if (mainCategoryInfo.subcategories['전체']) {
        return mainCategoryInfo.subcategories['전체'];
      }
      
      // 메인 카테고리만 반환
      return { 
        category_sno: mainCategoryInfo.category_sno, 
        sub_category_sno: 0 
      };
    } 
    
    // 메인 카테고리 정보가 단순 객체인 경우 (subcategories가 없는 경우)
    else if (typeof mainCategoryInfo === 'object' && 'category_sno' in mainCategoryInfo) {
      return {
        category_sno: mainCategoryInfo.category_sno,
        sub_category_sno: 'sub_category_sno' in mainCategoryInfo ? 
          mainCategoryInfo.sub_category_sno as number : 0
      };
    }
  }
  
  // 카테고리를 찾지 못한 경우 기본값 반환
  console.log(`에이블리 카테고리를 찾을 수 없음: ${categoryStr}, 기본값 반환`);
  return { category_sno: 8, sub_category_sno: 18 };
} 