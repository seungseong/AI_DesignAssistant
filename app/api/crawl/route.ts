import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
  }

  try {
    // 키워드에 따라 적절한 더미 데이터를 반환
    const lowerKeyword = keyword.toLowerCase();
    let itemType = 't-shirt'; // 기본값
    
    if (lowerKeyword.includes('티셔츠') || lowerKeyword.includes('tshirt') || lowerKeyword.includes('t-shirt')) {
      itemType = 't-shirt';
    } else if (lowerKeyword.includes('후드') || lowerKeyword.includes('hoodie')) {
      itemType = 'hoodie';
    } else if (lowerKeyword.includes('로고') || lowerKeyword.includes('logo')) {
      itemType = 'logo';
    } else if (lowerKeyword.includes('머그') || lowerKeyword.includes('mug') || lowerKeyword.includes('컵')) {
      itemType = 'mug';
    }
    
    const dummyData = {
      naver: getDummyNaverItems(itemType),
      ably: getDummyAblyItems(itemType)
    };

    return NextResponse.json(dummyData);
  } catch (error) {
    console.error('Error in API:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

function getDummyNaverItems(itemType: string) {
  const items = {
    't-shirt': [
      {
        id: 'naver-1',
        rank: 1,
        image: 'https://shopping-phinf.pstatic.net/main_3245204/32452042335.20220414162621.jpg',
        title: '[오늘출발] 베이직 무지 티셔츠',
        price: '12,900원',
        url: 'https://smartstore.naver.com/main/products/32452042335',
        brand: '데일리룩'
      },
      {
        id: 'naver-2',
        rank: 2,
        image: 'https://shopping-phinf.pstatic.net/main_8418892/84188921620.2.jpg',
        title: '프리미엄 오버핏 반팔티',
        price: '19,800원',
        url: 'https://smartstore.naver.com/main/products/82323992620',
        brand: '스타일리시'
      },
      {
        id: 'naver-3',
        rank: 3,
        image: 'https://shopping-phinf.pstatic.net/main_8232399/82323992620.4.jpg',
        title: '남녀공용 프린팅 티셔츠',
        price: '15,900원',
        url: 'https://smartstore.naver.com/main/products/82323992620',
        brand: '모던시크'
      }
    ],
    'hoodie': [
      {
        id: 'naver-1',
        image: 'https://shopping-phinf.pstatic.net/main_3667851/36678516622.jpg',
        title: '가을 기본 후드티',
        price: '29,800원',
        url: 'https://smartstore.naver.com/main/products/36678516622',
        brand: '데일리웨어'
      },
      {
        id: 'naver-2',
        image: 'https://shopping-phinf.pstatic.net/main_3532186/35321864125.jpg',
        title: '오버 사이즈 후드 집업',
        price: '39,800원',
        url: 'https://smartstore.naver.com/main/products/35321864125',
        brand: '어반스타일'
      },
      {
        id: 'naver-3',
        image: 'https://shopping-phinf.pstatic.net/main_8415557/84155578958.jpg',
        title: '커플 후드티 세트',
        price: '48,000원',
        url: 'https://smartstore.naver.com/main/products/84155578958',
        brand: '러브스토리'
      }
    ],
    'logo': [
      {
        id: 'naver-1',
        image: 'https://shopping-phinf.pstatic.net/main_3245204/32452042667.jpg',
        title: '로고 프린팅 맨투맨',
        price: '32,000원',
        url: 'https://smartstore.naver.com/main/products/32452042667',
        brand: '브랜드웨어'
      },
      {
        id: 'naver-2',
        image: 'https://shopping-phinf.pstatic.net/main_8232399/82323992875.jpg',
        title: '빈티지 로고 반팔티',
        price: '24,000원',
        url: 'https://smartstore.naver.com/main/products/82323992875',
        brand: '클래식몰'
      },
      {
        id: 'naver-3',
        image: 'https://shopping-phinf.pstatic.net/main_8587935/85879352124.jpg',
        title: '미니멀 로고 후드',
        price: '45,000원',
        url: 'https://smartstore.naver.com/main/products/85879352124',
        brand: '심플리즘'
      }
    ],
    'mug': [
      {
        id: 'naver-1',
        image: 'https://shopping-phinf.pstatic.net/main_3642744/36427447618.jpg',
        title: '세라믹 디자인 머그컵',
        price: '12,900원',
        url: 'https://smartstore.naver.com/main/products/36427447618',
        brand: '홈키친'
      },
      {
        id: 'naver-2',
        image: 'https://shopping-phinf.pstatic.net/main_8264811/82648116548.jpg',
        title: '북유럽 스타일 머그',
        price: '16,800원',
        url: 'https://smartstore.naver.com/main/products/82648116548',
        brand: '인테리어샵'
      },
      {
        id: 'naver-3',
        image: 'https://shopping-phinf.pstatic.net/main_8415557/84155575849.jpg',
        title: '커플 머그 세트',
        price: '24,900원',
        url: 'https://smartstore.naver.com/main/products/84155575849',
        brand: '선물하우스'
      }
    ]
  };
  
  return items[itemType as keyof typeof items] || items['t-shirt'];
}

function getDummyAblyItems(itemType: string) {
  const items = {
    't-shirt': [
      {
        id: 'ably-1',
        rank: 1,
        image: 'https://cf.product-image.s.zigzag.kr/images/2024032100/1009452647/1_960_1_9.jpg',
        title: '여름 베이직 크롭티',
        price: '15,800원',
        url: 'https://zigzag.kr/catalog/products/119618161',
        brand: '데일리어바웃'
      },
      {
        id: 'ably-2',
        rank: 2,
        image: 'https://cf.product-image.s.zigzag.kr/images/2023051901/1000000002/1_960_1_9.jpg',
        title: '스트라이프 반팔 티셔츠',
        price: '19,800원',
        url: 'https://zigzag.kr/catalog/products/103099602',
        brand: '베이직트렌드'
      },
      {
        id: 'ably-3',
        rank: 3,
        image: 'https://cf.product-image.s.zigzag.kr/images/2023033101/1003580864/1_960_1_9.jpg',
        title: '여성용 프린팅 티셔츠',
        price: '22,000원',
        url: 'https://zigzag.kr/catalog/products/100998642',
        brand: '러블리걸'
      }
    ],
    'hoodie': [
      {
        id: 'ably-1',
        image: 'https://image.a-bly.com/data/dailyabout/goods/6050231/vNl4GVMvCm.jpg',
        title: '오버핏 무지 후드티',
        price: '32,000원',
        url: 'https://www.a-bly.com/goods/6050231',
        brand: '스윗블랭크'
      },
      {
        id: 'ably-2',
        image: 'https://image.a-bly.com/data/dailyabout/goods/6050232/vNl4GVMvCm.jpg',
        title: '프렌치 크롭 후드집업',
        price: '42,800원',
        url: 'https://www.a-bly.com/goods/6050232',
        brand: '럽유'
      },
      {
        id: 'ably-3',
        image: 'https://image.a-bly.com/data/dailyabout/goods/6050233/vNl4GVMvCm.jpg',
        title: '캐주얼 후드 원피스',
        price: '39,800원',
        url: 'https://www.a-bly.com/goods/6050233',
        brand: '위미드'
      }
    ],
    'logo': [
      {
        id: 'ably-1',
        image: 'https://image.a-bly.com/data/dailyabout/goods/7050231/vNl4GVMvCm.jpg',
        title: '빈티지 로고 티셔츠',
        price: '26,500원',
        url: 'https://www.a-bly.com/goods/7050231',
        brand: '트렌디샵'
      },
      {
        id: 'ably-2',
        image: 'https://image.a-bly.com/data/dailyabout/goods/7050232/vNl4GVMvCm.jpg',
        title: '미니멀 로고 맨투맨',
        price: '36,000원',
        url: 'https://www.a-bly.com/goods/7050232',
        brand: '모던어반'
      },
      {
        id: 'ably-3',
        image: 'https://image.a-bly.com/data/dailyabout/goods/7050233/vNl4GVMvCm.jpg',
        title: '레터링 로고 후드',
        price: '44,000원',
        url: 'https://www.a-bly.com/goods/7050233',
        brand: '시크앤쿨'
      }
    ],
    'mug': [
      {
        id: 'ably-1',
        image: 'https://image.a-bly.com/data/dailyabout/goods/8050231/vNl4GVMvCm.jpg',
        title: '미니멀 디자인 머그',
        price: '13,500원',
        url: 'https://www.a-bly.com/goods/8050231',
        brand: '홈스타일'
      },
      {
        id: 'ably-2',
        image: 'https://image.a-bly.com/data/dailyabout/goods/8050232/vNl4GVMvCm.jpg',
        title: '핸드메이드 세라믹 머그',
        price: '19,800원',
        url: 'https://www.a-bly.com/goods/8050232',
        brand: '아트홈'
      },
      {
        id: 'ably-3',
        image: 'https://image.a-bly.com/data/dailyabout/goods/8050233/vNl4GVMvCm.jpg',
        title: '감성 문구 머그컵',
        price: '15,800원',
        url: 'https://www.a-bly.com/goods/8050233',
        brand: '감성상점'
      }
    ]
  };
  
  return items[itemType as keyof typeof items] || items['t-shirt'];
} 