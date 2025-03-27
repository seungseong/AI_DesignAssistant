import { NextResponse } from 'next/server';
import axios from 'axios';
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
      '맨투맨/스웨트셔츠': { category_sno: 8, sub_category_sno: 300 },
      '후드 티셔츠': { category_sno: 8, sub_category_sno: 500 }
    }
  },
  '아우터': {
    category_sno: 7,
    subcategories: {
      '전체': { category_sno: 7, sub_category_sno: 0 }
    }
  }
};

export async function GET(request: Request) {
  console.log('ably 크롤링 시작');
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const category = searchParams.get('category') || '';
  
  // 카테고리 문자열에서 옵션 가져오기
  const categoryOption = getCategoryOption(category);
  const category_sno = categoryOption.category_sno.toString();
  const sub_category_sno = categoryOption.sub_category_sno.toString();
  
  console.log(`카테고리 "${category}" → 카테고리_번호: ${category_sno}, 서브카테고리_번호: ${sub_category_sno}`);

  if (!keyword && (!category_sno || category_sno === '0') && category === '') {
    return NextResponse.json({ error: 'Keyword or category is required' }, { status: 400 });
  }

  try {
    let items: ShopItem[] = [];

    // 카테고리 코드로 스크래핑
    if (category_sno && category_sno !== '0') {
      // next_token은 고정된 값으로 설정 (실제로는 요청마다 새로 생성되어야 함)
      let rankingUrl;
      
      // 카테고리 및 서브카테고리에 따라 미리 정의된 URL 사용
      if (category_sno === '8') {
        // 상의 카테고리
        if (sub_category_sno === '0') {
          // 상의 > 전체
          rankingUrl = `https://m.a-bly.com/screens?screen_name=COMPONENT_LIST&next_token=eyJsIjogMSwgInAiOiB7ImRlcGFydG1lbnRfdHlwZSI6ICJDQVRFR09SWSIsICJjYXRlZ29yeV9zbm8iOiA4LCAicHJldmlvdXNfc2NyZWVuX25hbWUiOiAiQ0FURUdPUllfREVQQVJUTUVOVCIsICJmaWx0ZXJfY29tcG9uZW50IjogNjN9LCAiY2F0ZWdvcnlfc25vIjogOH0%3D&category_sno=8`;
        } else if (sub_category_sno === '18') {
          // 상의 > 반소매 티셔츠
          rankingUrl = `https://m.a-bly.com/screens?screen_name=COMPONENT_LIST&next_token=eyJsIjogMSwgInAiOiB7ImRlcGFydG1lbnRfdHlwZSI6ICJDQVRFR09SWSIsICJjYXRlZ29yeV9zbm8iOiA4LCAicHJldmlvdXNfc2NyZWVuX25hbWUiOiAiQ0FURUdPUllfREVQQVJUTUVOVCIsICJmaWx0ZXJfY29tcG9uZW50IjogNjN9LCAiY2F0ZWdvcnlfc25vIjogOH0%3D&category_sno=8&sub_category_sno=18`;
        } else if (sub_category_sno === '300') {
          // 상의 > 맨투맨/스웨트셔츠
          rankingUrl = `https://m.a-bly.com/screens?screen_name=COMPONENT_LIST&next_token=eyJsIjogMSwgInAiOiB7ImRlcGFydG1lbnRfdHlwZSI6ICJDQVRFR09SWSIsICJjYXRlZ29yeV9zbm8iOiA4LCAicHJldmlvdXNfc2NyZWVuX25hbWUiOiAiQ0FURUdPUllfREVQQVJUTUVOVCIsICJmaWx0ZXJfY29tcG9uZW50IjogNjN9LCAiY2F0ZWdvcnlfc25vIjogOH0%3D&category_sno=8&sub_category_sno=300`;
        } else if (sub_category_sno === '500') {
          // 상의 > 후드 티셔츠
          rankingUrl = `https://m.a-bly.com/screens?screen_name=COMPONENT_LIST&next_token=eyJsIjogMSwgInAiOiB7ImRlcGFydG1lbnRfdHlwZSI6ICJDQVRFR09SWSIsICJjYXRlZ29yeV9zbm8iOiA4LCAicHJldmlvdXNfc2NyZWVuX25hbWUiOiAiQ0FURUdPUllfREVQQVJUTUVOVCIsICJmaWx0ZXJfY29tcG9uZW50IjogNjN9LCAiY2F0ZWdvcnlfc25vIjogOH0%3D&category_sno=8&sub_category_sno=500`;
        } else {
          // 기본값 (상의 > 전체)
          rankingUrl = `https://m.a-bly.com/screens?screen_name=COMPONENT_LIST&next_token=eyJsIjogMSwgInAiOiB7ImRlcGFydG1lbnRfdHlwZSI6ICJDQVRFR09SWSIsICJjYXRlZ29yeV9zbm8iOiA4LCAicHJldmlvdXNfc2NyZWVuX25hbWUiOiAiQ0FURUdPUllfREVQQVJUTUVOVCIsICJmaWx0ZXJfY29tcG9uZW50IjogNjN9LCAiY2F0ZWdvcnlfc25vIjogOH0%3D&category_sno=8`;
        }
      } else if (category_sno === '7') {
        // 아우터 카테고리
        rankingUrl = `https://m.a-bly.com/screens?screen_name=COMPONENT_LIST&next_token=eyJsIjogMSwgInAiOiB7ImRlcGFydG1lbnRfdHlwZSI6ICJDQVRFR09SWSIsICJjYXRlZ29yeV9zbm8iOiA3LCAicHJldmlvdXNfc2NyZWVuX25hbWUiOiAiQ0FURUdPUllfREVQQVJUTUVOVCIsICJmaWx0ZXJfY29tcG9uZW50IjogNjN9LCAiY2F0ZWdvcnlfc25vIjogN30%3D&category_sno=7`;
      } else {
        // 지원하지 않는 카테고리일 경우 기본 URL
        rankingUrl = `https://m.a-bly.com/ranking`;
      }
      
      console.log('Requesting Ably URL:', rankingUrl);
      
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
        await page.goto(rankingUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 페이지가 로드되면 HTML 콘텐츠 가져오기
        const content = await page.content();
        const $ = cheerio.load(content);
        
        console.log('HTML 콘텐츠 로드 완료, 상품 정보 추출 시작');
        
        // 에이블리 HTML 구조에 맞게 상품 추출
        // 상품 컨테이너 찾기
        const productContainers = $('.sc-b3c10446-0.fLZaoW.sc-2efdd3c6-0.iGHAmn');

        console.log(`상품 컨테이너 ${productContainers.length}개 발견`);
        
        productContainers.slice(0, 3).each((i, el) => {
          const rank = i + 1;

          // 이미지 찾기 - 특정 클래스 내에서만 찾기
          const mainImageEl = $(el).find('.sc-ecca1885-3.fQtenw.sc-5b700d3e-0.jTuGWe');
          console.log(rank, '메인 이미지 컨테이너:', mainImageEl.length);
          const imageEl = mainImageEl.find('img');
          console.log(rank, '이미지 요소:', imageEl.length);
          let image = imageEl.attr('src') || imageEl.attr('data-src') || '';
          console.log(rank, '이미지 소스:', image);

          // 이미지가 없으면 다른 이미지 요소 찾기 시도
          if (!image) {
            const altImageEl = $(el).find('img').first();
            image = altImageEl.attr('src') || altImageEl.attr('data-src') || '';
            console.log(rank, '대체 이미지 소스:', image);
          }

          // 이미지가 여전히 없으면 기본 이미지 사용
          if (!image) {
            image = 'https://image.a-bly.com/images/no_image.jpg';
            console.log(rank, '기본 이미지 사용');
          }

          
          // 브랜드명과 상품명이 있는 컨테이너 찾기
          const infoContainer = $(el).find('.sc-2efdd3c6-2.ibTWTl');
          console.log(rank, '상품 정보 컨테이너:', infoContainer.text());

          // 브랜드명 찾기 (p 태그)
          const brandEl = $(infoContainer).closest('p').find('.typography.typography_subtitle4.typography_ellipsis.color_gгay60');
          const brand = brandEl.text().trim();
          console.log(rank, '브랜드:', brand);

          // 상품명 찾기 (p 태그)
          const titleEl = $(infoContainer).closest('p').find('.typography.typography_bodyd.typography_ellipsis.color_gray6o');
          const title = titleEl.text().trim();
          console.log(rank, '상품명:', title); 

          // 가격 찾기
          const priceEl = $(el).find('.sc-cc3fb985-0.jcHbjU');
          const price = priceEl.text().trim().replace(/^.*%/, '') + '원';
          console.log(rank, '가격:', price);
          
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
            category: getCategoryName(category_sno, sub_category_sno)
          };
          
          console.log(`${rank}위 상품 추출:`, { title: item.title, brand: item.brand });
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
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 페이지가 로드되면 HTML 콘텐츠 가져오기
        const content = await page.content();
        const $ = cheerio.load(content);
        
        // 검색 결과에서 상품 항목 추출
        const productItems = $('.sc-b3c10446-0.fLZaoW.sc-2efdd3c6-0.iGHAmn .sc-2efdd3c6-1.jNmUoh');
        
        productItems.slice(0, 3).each((i, el) => {
          const rank = i + 1;
          
          // 이미지 찾기 - 특정 클래스 내에서만 찾기
          const mainImageEl = $(el).find('.sc-ecca1885-3.fQtenw.sc-5b700d3e-0.jTuGWe');
          console.log(rank, '메인 이미지 컨테이너:', mainImageEl.length);
          const imageEl = mainImageEl.find('img');
          console.log(rank, '이미지 요소:', imageEl.length);
          let image = imageEl.attr('src') || imageEl.attr('data-src') || '';
          console.log(rank, '이미지 소스:', image);

          // 이미지가 없으면 다른 이미지 요소 찾기 시도
          if (!image) {
            const altImageEl = $(el).find('img').first();
            image = altImageEl.attr('src') || altImageEl.attr('data-src') || '';
            console.log(rank, '대체 이미지 소스:', image);
          }

          // 이미지가 여전히 없으면 기본 이미지 사용
          if (!image) {
            image = 'https://image.a-bly.com/images/no_image.jpg';
            console.log(rank, '기본 이미지 사용');
          }
          
          // 브랜드명과 상품명이 있는 컨테이너 찾기
          const infoContainer = $(el).find('.sc-2efdd3c6-2.ibTWTl');
          console.log(rank, '상품 정보 컨테이너:', infoContainer.length);

          // 브랜드명 찾기 (p 태그)
          const brandEl = infoContainer.find('p.typography.typography_subtitle4.typography_ellipsis.color_gгay60');
          const brand = brandEl.text().trim();
          console.log(rank, '브랜드:', brand);

          // 상품명 찾기 (p 태그)
          const titleEl = infoContainer.find('p.typography.typography_bodyd.typography_ellipsis.color_gray6o');
          const title = titleEl.text().trim();
          console.log(rank, '상품명:', title);

          // 가격 찾기
          const priceEl = $(el).find('.sc-cc3fb985-0.jcHbjU');
          const price = (priceEl.text().trim().replace(/^.*%/, '') || '가격정보 없음') + '원';
          console.log(rank, '가격:', price);
          
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
          
          console.log('키워드 검색 상품:', { title: item.title });
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
      items = getDummyItems(keyword || '', category_sno, sub_category_sno);
    } else if (items.length < 3) {
      // 3개 미만이면 더미 데이터로 채움
      const dummyItems = getDummyItems(keyword || '', category_sno, sub_category_sno);
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
    const dummyItems = getDummyItems(keyword || '', category_sno, sub_category_sno);
    return NextResponse.json(dummyItems);
  }
}

// 카테고리 코드에 해당하는 카테고리명 반환
function getCategoryName(category_sno: string, sub_category_sno?: string): string {
  const catSno = Number(category_sno);
  const subCatSno = Number(sub_category_sno || '0');
  
  // 전체 카테고리
  if (catSno === 0) return '전체';
  
  // 메인 카테고리 찾기
  for (const [mainName, mainCategory] of Object.entries(ABLY_CATEGORIES)) {
    if (mainName === '전체') continue;
    
    if (typeof mainCategory === 'object' && 'category_sno' in mainCategory && mainCategory.category_sno === catSno) {
      // 서브카테고리가 없거나 0이면 메인 카테고리만 반환
      if (!subCatSno || subCatSno === 0) return mainName;
      
      // 서브카테고리 찾기
      if ('subcategories' in mainCategory && mainCategory.subcategories) {
        for (const [subName, subCategory] of Object.entries(mainCategory.subcategories)) {
          if (typeof subCategory === 'object' && 
              'category_sno' in subCategory && 
              'sub_category_sno' in subCategory &&
              subCategory.category_sno === catSno && 
              subCategory.sub_category_sno === subCatSno) {
            return `${mainName} > ${subName}`;
          }
        }
      }
      
      // 서브카테고리를 찾지 못했으면 메인 카테고리만 반환
      return mainName;
    }
  }
  
  return '알 수 없음';
}

// 더미 데이터 반환 함수
function getDummyItems(keyword: string, category_sno: string, sub_category_sno?: string): ShopItem[] {
  const categoryName = getCategoryName(category_sno, sub_category_sno);
  
  // 카테고리별 더미 데이터
  if (category_sno === '8' && sub_category_sno === '500') {
    // 후드티
    return [
      {
        id: 'ably-1',
        rank: 1,
        image: 'https://image.a-bly.com/data/dailyabout/goods/6050231/vNl4GVMvCm.jpg',
        title: '오버핏 무지 후드티',
        price: '32,000원',
        url: 'https://www.a-bly.com/goods/6050231',
        brand: '스윗블랭크',
        category: categoryName
      },
      {
        id: 'ably-2',
        rank: 2,
        image: 'https://image.a-bly.com/data/dailyabout/goods/6050232/vNl4GVMvCm.jpg',
        title: '프렌치 크롭 후드집업',
        price: '42,800원',
        url: 'https://www.a-bly.com/goods/6050232',
        brand: '럽유',
        category: categoryName
      },
      {
        id: 'ably-3',
        rank: 3,
        image: 'https://image.a-bly.com/data/dailyabout/goods/6050233/vNl4GVMvCm.jpg',
        title: '캐주얼 후드 원피스',
        price: '39,800원',
        url: 'https://www.a-bly.com/goods/6050233',
        brand: '위미드',
        category: categoryName
      }
    ];
  } else if (category_sno === '8' && sub_category_sno === '18') {
    // 반소매 티셔츠
    return [
      {
        id: 'ably-1',
        rank: 1,
        image: 'https://cf.product-image.s.zigzag.kr/images/2024032100/1009452647/1_960_1_9.jpg',
        title: '여름 베이직 크롭티',
        price: '15,800원',
        url: 'https://zigzag.kr/catalog/products/119618161',
        brand: '데일리어바웃',
        category: categoryName
      },
      {
        id: 'ably-2',
        rank: 2,
        image: 'https://cf.product-image.s.zigzag.kr/images/2023051901/1000000002/1_960_1_9.jpg',
        title: '스트라이프 반팔 티셔츠',
        price: '19,800원',
        url: 'https://zigzag.kr/catalog/products/103099602',
        brand: '베이직트렌드',
        category: categoryName
      },
      {
        id: 'ably-3',
        rank: 3,
        image: 'https://cf.product-image.s.zigzag.kr/images/2023033101/1003580864/1_960_1_9.jpg',
        title: '여성용 프린팅 티셔츠',
        price: '22,000원',
        url: 'https://zigzag.kr/catalog/products/100998642',
        brand: '러블리걸',
        category: categoryName
      }
    ];
  } else if (category_sno === '8' && sub_category_sno === '300') {
    // 맨투맨
    return [
      {
        id: 'ably-1',
        rank: 1,
        image: 'https://image.a-bly.com/data/dailyabout/goods/7050232/vNl4GVMvCm.jpg',
        title: '미니멀 로고 맨투맨',
        price: '36,000원',
        url: 'https://www.a-bly.com/goods/7050232',
        brand: '모던어반',
        category: categoryName
      },
      {
        id: 'ably-2',
        rank: 2,
        image: 'https://cf.product-image.s.zigzag.kr/images/2022091501/1003689754/1_960_1_9.jpg',
        title: '오버핏 기모 맨투맨',
        price: '28,900원',
        url: 'https://zigzag.kr/catalog/products/98765432',
        brand: '코디스토리',
        category: categoryName
      },
      {
        id: 'ably-3',
        rank: 3,
        image: 'https://cf.product-image.s.zigzag.kr/images/2022102201/1005689754/1_960_1_9.jpg',
        title: '컬러 블럭 맨투맨',
        price: '32,800원',
        url: 'https://zigzag.kr/catalog/products/87654321',
        brand: '트렌디룩',
        category: categoryName
      }
    ];
  } else {
    // 기본 상품
    return [
      {
        id: 'ably-1',
        rank: 1,
        image: 'https://cf.product-image.s.zigzag.kr/images/2024032100/1009452647/1_960_1_9.jpg',
        title: '[여리찰량] 사계절 레이어드 셔링 프릴 민소매 원피스 이너 나시 3color',
        price: '15,800원',
        url: 'https://zigzag.kr/catalog/products/119618161',
        brand: '히릿',
        category: categoryName
      },
      {
        id: 'ably-2',
        rank: 2,
        image: 'https://image.a-bly.com/data/dailyabout/goods/6050232/vNl4GVMvCm.jpg',
        title: '프렌치 크롭 후드집업',
        price: '42,800원',
        url: 'https://www.a-bly.com/goods/6050232',
        brand: '럽유',
        category: categoryName
      },
      {
        id: 'ably-3',
        rank: 3,
        image: 'https://cf.product-image.s.zigzag.kr/images/2022102201/1005689754/1_960_1_9.jpg',
        title: '컬러 블럭 맨투맨',
        price: '32,800원',
        url: 'https://zigzag.kr/catalog/products/87654321',
        brand: '트렌디룩',
        category: categoryName
      }
    ];
  }
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
  return { category_sno: 0, sub_category_sno: 0 };
} 