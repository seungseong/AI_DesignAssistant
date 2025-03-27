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

// 무신사 카테고리 코드 정의 - 인터페이스 추가
interface MusinsaSubcategories {
  [key: string]: string;
}

interface MusinsaCategory {
  code: string;
  subcategories: MusinsaSubcategories;
}

interface MusinsaCategories {
  [key: string]: string | MusinsaCategory;
}

const MUSINSA_CATEGORIES: MusinsaCategories = {
  '전체': '000',
  '상의': {
    code: '001',
    subcategories: {
      '전체': '001000',
      '반소매 티셔츠': '001001',
      '긴소매 티셔츠': '001002',
      '맨투맨/스웨트셔츠': '001003',
      '후드 티셔츠': '001004',
      '니트/스웨터': '001005',
      '기타 상의': '001006'
    }
  },
  '아우터': {
    code: '002',
    subcategories: {
      '전체': '002000',
      '블루종/MA-1': '002001',
      '레더 재킷': '002002',
      '무스탕/퍼': '002003',
      '트러커 재킷': '002004',
      '수트/블레이저': '002005'
    }
  },
  '바지': {
    code: '003',
    subcategories: {
      '전체': '003000',
      '데님 팬츠': '003001',
      '코튼 팬츠': '003002',
      '슈트 팬츠/슬랙스': '003003',
      '트레이닝/조거 팬츠': '003004'
    }
  },
  '신발': {
    code: '005',
    subcategories: {
      '전체': '005000',
      '스니커즈': '005001',
      '구두/로퍼': '005002',
      '샌들/슬리퍼': '005003',
      '기타 신발': '005004'
    }
  }
};

const CATEGORIES = [
  { value: '000', label: '전체' },
  { 
    label: '상의', 
    children: [
      { value: '001000', label: '상의 전체' },
      { value: '001001', label: '반소매 티셔츠' },
      { value: '001004', label: '후드 티셔츠' },
      { value: '001003', label: '맨투맨/스웨트셔츠' },
      { value: '001005', label: '니트/스웨터' }
    ]
  },
  { 
    label: '아우터', 
    children: [
      { value: '002000', label: '아우터 전체' },
      { value: '002001', label: '블루종/MA-1' },
      { value: '002002', label: '레더 재킷' },
      { value: '002005', label: '수트/블레이저' }
    ]
  },
  { 
    label: '바지', 
    children: [
      { value: '003000', label: '바지 전체' },
      { value: '003001', label: '데님 팬츠' },
      { value: '003002', label: '코튼 팬츠' },
      { value: '003004', label: '트레이닝/조거 팬츠' }
    ]
  },
  { 
    label: '신발', 
    children: [
      { value: '005000', label: '신발 전체' },
      { value: '005001', label: '스니커즈' },
      { value: '005002', label: '구두/로퍼' }
    ]
  },
  { value: '전체', label: '전체' }
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const category = searchParams.get('category') || '전체'; // 기본값: 전체
  
  // 카테고리 코드 가져오기 (문자열 카테고리로부터)
  const categoryCode = getCategoryCode(category);

  if (!keyword && !category) {
    return NextResponse.json({ error: 'Keyword or category is required' }, { status: 400 });
  }

  try {
    // 카테고리 코드가 있으면 카테고리별 랭킹 페이지에서 상품 가져오기
    if (categoryCode) {
      const sectionId = '199';
      const rankingUrl = `https://www.musinsa.com/main/musinsa/ranking?storeCode=musinsa&sectionId=${sectionId}&categoryCode=${categoryCode}&contentsId=`;
      
      // Puppeteer를 사용하여 동적 페이지 로딩
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      try {
        const page = await browser.newPage();
        
        // User-Agent 설정
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
        
        // 페이지 로딩
        await page.goto(rankingUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 페이지가 로드되면 HTML 콘텐츠 가져오기
        const content = await page.content();
        const $ = cheerio.load(content);
        const items: ShopItem[] = [];
        
        // 제공된 HTML 구조에 맞게 상품 추출
        // 1. 랭킹 컨테이너 찾기 (.sc-1y072n9-0.jdzDMq)
        const rankingContainers = $('.sc-1y072n9-0.jdzDMq');
        
        if (rankingContainers.length > 0) {          
          // 첫 번째 컨테이너에서 상품 아이템 찾기 (1,2,3위 포함)
          const firstContainer = rankingContainers.first();
          
          // 상품 아이템 찾기 (.sc-1m4cyao-0.dQNLfk)
          const productItems = firstContainer.find('.sc-1m4cyao-0.dQNLfk').slice(0, 3);
          
          productItems.each((i, el) => {
            const rank = i + 1; // 1, 2, 3위
            
            // 상품 링크 요소 찾기 (div.sc-1m4cyao-1.dYjLwF > a)
            const linkContainer = $(el).find('.sc-1m4cyao-1.dYjLwF');
            const linkEl = linkContainer.find('a');
            const link = linkEl.attr('href') || '';
            
            // 상품 ID 추출 (URL에서)
            const itemId = link.split('/').pop() || '';
            
            // 이미지 찾기
            const imageEl = $(el).find('img');
            let image = imageEl.attr('src') || imageEl.attr('data-src') || '';
            
            if (image && !image.startsWith('http')) {
              image = image.startsWith('//') ? `https:${image}` : `https://www.musinsa.com${image}`;
            }
            
            // 이미지 alt 속성에서 브랜드명과 상품명 추출
            let brand = '';
            let title = '';
            const altText = imageEl.attr('alt') || '';
            
            // alt 속성에서 추출 시도
            if (altText && altText.includes('상품 이미지')) {
              const matches = altText.match(/^(.+?)\s+(.+?)\s+상품\s+이미지$/);
              if (matches && matches.length >= 3) {
                brand = matches[1].trim();
                title = matches[2].trim();
              }
            }
            
            // 브랜드명 또는 상품명이 추출되지 않은 경우 기존 방식으로 시도
            if (!brand) {
              const brandTextEl = $(el).find('[class*="dfjLFp"]');
              brand = brandTextEl.text().trim();
            }
            
            if (!title) {
              const titleTextEl = $(el).find('[class*="dyjLyP"]');
              title = titleTextEl.text().trim();
            }
            
            // 가격 데이터 찾기
            const priceDataEl = $(el).closest('[data-price]');
            let price = '';
            if (priceDataEl.length > 0) {
              const priceData = priceDataEl.attr('data-price');
              if (priceData) {
                price = parseInt(priceData).toLocaleString() + '원';
              }
            }
            
            if (!price) {
              // 직접 가격 요소 찾기
              const priceEl = $(el).find('.price, [class*="price"]');
              price = priceEl.text().trim().replace(/\s+/g, ' ');
            }
            
            // 상품 정보 완성
            const item: ShopItem = {
              id: `musinsa-${itemId || rank}`,
              rank,
              image: image || 'https://image.msscdn.net/images/no_image_125.png',
              title: title || '무신사 상품',
              price: price || '가격정보 없음',
              url: link.startsWith('http') ? link : `https://www.musinsa.com${link}`,
              brand: brand || '브랜드 정보 없음',
            };
            
            items.push(item);
          });
        } else {
          // HTML 구조 디버깅을 위한 기본 요소들 출력
          const bodyHtml = $('body').html()?.substring(0, 500) || '';
          console.log('HTML 구조 디버깅:', bodyHtml);
        }
        
        // 항상 3개의 아이템을 유지하기 위해 필요시 더미 데이터로 채움
        if (items.length === 0) {
          const dummyItems = getDummyItems();
          await browser.close();
          return NextResponse.json(dummyItems);
        } else if (items.length < 3) {
          // 추출된 항목이 3개 미만이면 부족한 만큼 더미로 채움
          const dummyItems = getDummyItems();
          while (items.length < 3) {
            const dummyIndex: number = items.length;
            if (dummyItems[dummyIndex]) {
              items.push({
                ...dummyItems[dummyIndex],
                id: `musinsa-dummy-${items.length + 1}`,
                rank: items.length + 1
              });
            } else {
              break;
            }
          }
        }
        
        await browser.close();
        return NextResponse.json(items);
      } catch (error) {
        console.error('Puppeteer 처리 오류:', error);
        await browser.close();
        throw error;
      }
    }
    
    // 키워드 검색 (카테고리 검색에 실패했거나 키워드만 있는 경우)
    if (keyword) {
      const searchUrl = `https://www.musinsa.com/search/musinsa/goods?q=${encodeURIComponent(keyword)}&list_kind=small&sortCode=pop`;
      
      // Puppeteer로 검색 페이지 크롤링
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      try {
        const page = await browser.newPage();
        
        // User-Agent 설정
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
        
        // 페이지 로딩
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 페이지가 로드되면 HTML 콘텐츠 가져오기
        const content = await page.content();
        const $ = cheerio.load(content);
        const items: ShopItem[] = [];
        
        // 검색 결과에서 상품 항목 추출 (인기순으로 정렬된 상태)
        $('.li_box, .search-item, .search_list_item, [class*="li_box"]').slice(0, 3).each((i, el) => {
          const imageEl = $(el).find('.list_img img, .img-block img, .search-img img, .lazyload, img.lazy, img');
          const linkEl = $(el).find('.list_info a.goods_link, a.store-product-link, a.search-product-link, a.name_box, a');
          const titleEl = $(el).find('.list_info .item_title, .product-title, .search-title, .item_name');
          const priceEl = $(el).find('.price, .product-price, .search-price');
          const brandEl = $(el).find('.brand, .product-brand, .search-brand, .item_title');
          
          // 다양한 이미지 속성 시도
          let image = imageEl.attr('data-original') || imageEl.attr('src') || imageEl.attr('data-src') || '';
          
          // 이미지 URL이 상대 경로이거나 프로토콜이 없는 경우 수정
          if (image && !image.startsWith('http')) {
            // //로 시작하는 경우 (프로토콜이 없는 경우)
            if (image.startsWith('//')) {
              image = `https:${image}`;
            } else {
              // 완전 상대 경로인 경우
              image = `https://www.musinsa.com${image}`;
            }
          }
          
          // 이미지 URL이 없는 경우 기본 이미지 사용
          if (!image || image === 'https://www.musinsa.com') {
            image = 'https://image.msscdn.net/images/no_image_125.png';
          }
          
          let link = linkEl.attr('href') || '';
          if (link && !link.startsWith('http')) {
            link = `https://www.musinsa.com${link}`;
          }
          
          const item: ShopItem = {
            id: `musinsa-${i+1}`,
            rank: i+1,
            image: image,
            title: titleEl.text().trim() || '무신사 상품',
            price: priceEl.text().trim().replace(/\s+/g, ' ') || '가격정보 없음',
            url: link,
            brand: brandEl.text().trim() || '브랜드 정보 없음',
          };
          
          items.push(item);
        });
        
        await browser.close();
        
        if (items.length > 0) {
          return NextResponse.json(items);
        }
        
        // 상품을 찾지 못한 경우 더미 데이터 반환
        throw new Error('Failed to fetch data');
      } catch (error) {
        console.error('Puppeteer 검색 오류:', error);
        await browser.close();
        throw error;
      }
    }
    
    // 데이터를 가져오지 못한 경우 더미 데이터 반환
    throw new Error('Failed to fetch data');
    
  } catch (error) {
    console.error('Error scraping Musinsa:', error);
    
    // 더미 데이터 반환
    const dummyItems = getDummyItems();
    
    return NextResponse.json(dummyItems);
  }
}

// 문자열 카테고리를 코드로 변환하는 함수
function getCategoryCode(categoryStr: string): string {
  // 기본값
  if (!categoryStr || categoryStr === '전체') return '000';
  
  // 카테고리가 "상위>하위" 형식인지 확인
  const parts = categoryStr.split('>');
  const mainCategory = parts[0].trim();
  const subCategory = parts.length > 1 ? parts[1].trim() : '전체';
  
  // 메인 카테고리 검사
  if (mainCategory in MUSINSA_CATEGORIES) {
    const mainCategoryInfo = MUSINSA_CATEGORIES[mainCategory];
    
    // 메인 카테고리만 지정된 경우 (또는 하위카테고리가 '전체'인 경우)
    if (typeof mainCategoryInfo === 'object' && 'subcategories' in mainCategoryInfo) {
      if (subCategory === '전체') {
        return mainCategoryInfo.subcategories['전체'];
      }
      
      // 하위 카테고리 검사
      for (const [subName, subCode] of Object.entries(mainCategoryInfo.subcategories)) {
        if (subName === subCategory) {
          return subCode;
        }
      }
    } else if (typeof mainCategoryInfo === 'string') {
      return mainCategoryInfo;
    }
  }
  
  // CATEGORIES 배열에서도 검색 (UI와 일치시키기 위해)
  for (const category of CATEGORIES) {
    if ('label' in category && category.label === mainCategory && 'children' in category) {
      // 하위 카테고리 검색
      const subCategories = category.children || [];
      for (const subCat of subCategories) {
        if ('label' in subCat && 'value' in subCat && subCat.label.includes(subCategory)) {
          return subCat.value as string;
        }
      }
      
      // 하위 카테고리를 찾지 못한 경우 메인 카테고리 전체 반환
      if (subCategories.length > 0 && 'value' in subCategories[0]) {
        return subCategories[0].value as string; // 메인 카테고리의 '전체' 항목 코드 반환
      }
    } else if ('value' in category && 'label' in category && category.label === mainCategory) {
      return category.value as string;
    }
  }
  
  // 카테고리를 찾지 못한 경우 기본값 반환
  console.log(`카테고리를 찾을 수 없음: ${categoryStr}, 기본값 반환`);
  return '000';
}

// 카테고리별 더미 데이터 반환
function getDummyItems(): ShopItem[] {
  // 카테고리와 관계없이 빈 이미지를 표시하는 데이터 반환
  return [
    {
      id: 'musinsa-1',
      rank: 1,
      image: 'https://image.msscdn.net/images/no_image_125.png',
      title: '상품 정보가 없습니다',
      price: '',
      url: 'https://www.musinsa.com',
      brand: '',
      category: ''
    },
    {
      id: 'musinsa-2',
      rank: 2,
      image: 'https://image.msscdn.net/images/no_image_125.png',
      title: '상품 정보가 없습니다',
      price: '',
      url: 'https://www.musinsa.com',
      brand: '',
      category: ''
    },
    {
      id: 'musinsa-3',
      rank: 3,
      image: 'https://image.msscdn.net/images/no_image_125.png',
      title: '상품 정보가 없습니다',
      price: '',
      url: 'https://www.musinsa.com',
      brand: '',
      category: ''
    }
  ];
} 