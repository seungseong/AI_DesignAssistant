import axios from 'axios';
import { load } from 'cheerio';
import { NextResponse } from 'next/server';

// 상품 타입 정의
export interface ShopItem {
  id: string;
  image: string;
  title: string;
  price: string;
  url: string;
  brand?: string;
  rank?: number;
}
/*
// 무신사 크롤링 함수 - 백엔드에서 처리하므로 더 이상 사용하지 않음
async function crawlMusinsa(keyword: string): Promise<ShopItem[]> {
  try {
    const response = await axios.get(`https://www.musinsa.com/search/musinsa/goods?q=${encodeURIComponent(keyword)}`);
    const $ = load(response.data);
    const items: ShopItem[] = [];

    $('.li_box').slice(0, 3).each((i, el) => {
      const item: ShopItem = {
        id: `musinsa-${i}`,
        image: $(el).find('.list_img img').attr('src') || '',
        title: $(el).find('.list_info a').text().trim(),
        price: $(el).find('.price').text().trim(),
        url: 'https://www.musinsa.com' + ($(el).find('.list_info a').attr('href') || '')
      };
      items.push(item);
    });

    return items;
  } catch (error) {
    console.error('Error crawling Musinsa:', error);
    return [];
  }
}

// 네이버 스마트스토어 크롤링 함수 - 백엔드에서 처리하므로 더 이상 사용하지 않음
async function crawlNaverStore(keyword: string): Promise<ShopItem[]> {
  try {
    const response = await axios.get(`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&sort=rel`);
    const $ = load(response.data);
    const items: ShopItem[] = [];

    $('.basicList_item__0T9JD').slice(0, 3).each((i, el) => {
      const item: ShopItem = {
        id: `naver-${i}`,
        image: $(el).find('.thumbnail_thumb__Bxb6Z img').attr('src') || '',
        title: $(el).find('.basicList_title__VfX3c').text().trim(),
        price: $(el).find('.price_num__S2p_v').text().trim(),
        url: $(el).find('.basicList_title__VfX3c a').attr('href') || ''
      };
      items.push(item);
    });

    return items;
  } catch (error) {
    console.error('Error crawling Naver Store:', error);
    return [];
  }
}

// 에이블리 크롤링 함수 - 백엔드에서 처리하므로 더 이상 사용하지 않음
async function crawlAbly(keyword: string): Promise<ShopItem[]> {
  try {
    const response = await axios.get(`https://www.a-bly.com/search?keyword=${encodeURIComponent(keyword)}`);
    const $ = load(response.data);
    const items: ShopItem[] = [];

    $('.product-item').slice(0, 3).each((i, el) => {
      const item: ShopItem = {
        id: `ably-${i}`,
        image: $(el).find('.product-image img').attr('src') || '',
        title: $(el).find('.product-name').text().trim(),
        price: $(el).find('.product-price').text().trim(),
        url: 'https://www.a-bly.com' + ($(el).find('a').attr('href') || '')
      };
      items.push(item);
    });

    return items;
  } catch (error) {
    console.error('Error crawling Ably:', error);
    return [];
  }
}
*/
// 통합 크롤링 함수
export async function crawlShopItems(keyword: string, category: string = ''): Promise<{ 
  musinsa: ShopItem[], 
  ably: ShopItem[] 
}> {
  try {
    console.log(`크롤링 요청: 키워드=${keyword}, 카테고리=${category}`);
    
    // API 요청을 병렬로 처리하고 에러 처리 개선
    console.log(`[API 요청] 무신사: /api/musinsa?keyword=${encodeURIComponent(keyword)}&category=${category}`);
    console.log(`[API 요청] 에이블리: /api/ably?keyword=${encodeURIComponent(keyword)}&category=${category}`);
    
    const [musinsaResponse, ablyResponse] = await Promise.allSettled([
      axios.get(`/api/musinsa?keyword=${encodeURIComponent(keyword)}&category=${category}`),
      axios.get(`/api/ably?keyword=${encodeURIComponent(keyword)}&category=${category}`),
    ]);
    
    // 무신사 데이터 처리
    let musinsaData: ShopItem[] = [];
    if (musinsaResponse.status === 'fulfilled') {
      console.log('무신사 응답 성공:', musinsaResponse.value.status);
      if (musinsaResponse.value.data && Array.isArray(musinsaResponse.value.data)) {
        musinsaData = musinsaResponse.value.data;
        console.log(`무신사 상품 ${musinsaData.length}개 로드됨`);
      } else {
        console.warn('무신사 응답 형식이 예상과 다름:', typeof musinsaResponse.value.data);
        if (typeof musinsaResponse.value.data === 'object') {
          console.log('무신사 응답 데이터:', JSON.stringify(musinsaResponse.value.data).substring(0, 100) + '...');
        }
      }
    } else {
      console.error('무신사 데이터 가져오기 실패:', musinsaResponse.reason);
    }
    
    // 에이블리 데이터 처리
    let ablyData: ShopItem[] = [];
    if (ablyResponse.status === 'fulfilled') {
      console.log('에이블리 응답 성공:', ablyResponse.value.status);
      if (ablyResponse.value.data && Array.isArray(ablyResponse.value.data)) {
        ablyData = ablyResponse.value.data;
        console.log(`에이블리 상품 ${ablyData.length}개 로드됨`);
      } else {
        console.warn('에이블리 응답 형식이 예상과 다름:', typeof ablyResponse.value.data);
      }
    } else {
      console.error('에이블리 데이터 가져오기 실패:', ablyResponse.reason);
    }
    
    const result = {
      musinsa: musinsaData,
      ably: ablyData
    };
    
    console.log('크롤링 완료:', result);
    return result;
  } catch (error) {
    console.error('Error fetching shop items:', error);
    // 모든 쇼핑몰 데이터 요청이 실패해도 빈 배열 반환
    return {
      musinsa: [],
      ably: []
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
  }

  try {
    const dummyData = {
      musinsa: [
        {
          id: 'musinsa-1',
          image: 'https://image.msscdn.net/images/goods_img/20230426/3289991/3289991_16825376032741_500.jpg',
          title: '베이직 티셔츠',
          price: '29,000원',
          url: 'https://www.musinsa.com/app/goods/3289991'
        },
        // Add more dummy items...
      ],
      naver: [
        {
          id: 'naver-1',
          image: 'https://shopping-phinf.pstatic.net/main_3667851/36678516618.20230426151833.jpg',
          title: '심플 티셔츠',
          price: '19,900원',
          url: 'https://smartstore.naver.com/main/products/36678516618'
        },
        // Add more dummy items...
      ],
      ably: [
        {
          id: 'ably-1',
          image: 'https://image.a-bly.com/data/goods/1234/1234567_1.jpg',
          title: '트렌디 티셔츠',
          price: '25,000원',
          url: 'https://www.a-bly.com/goods/1234567'
        },
        // Add more dummy items...
      ]
    };

    return NextResponse.json(dummyData);
  } catch (error) {
    console.error('Error crawling:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
} 