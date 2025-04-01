'use client'

import { useState, KeyboardEvent, useEffect } from 'react'
import { analyzeCharacter, createImagePrompt, generateDalleImage, generateGeminiImage, resetOpenAIClient } from '@/utils/imageApi'
import { crawlShopItems, type ShopItem } from '@/utils/scrapingApi'
import Image from 'next/image'

type ItemType = '상의>반소매 티셔츠' | '상의>긴소매 티셔츠' | '하의>팬츠' | '상의>맨투맨/스웨트셔츠' | '상의>후드 티셔츠' | 
                '의류>니트/스웨터' | '신발>스니커즈' | '주얼리>목걸이/펜던트' | '패션잡화>모자' | '패션잡화>가방' | '의류>셔츠/블라우스' |
                '의류>재킷/점퍼' | '의류>가디건' | '의류>슈트' | '의류>코트' | '의류>베스트' | '의류>패딩' | '의류>무스탕' | 
                '의류>플리스/후리스' | '의류>원피스' | '의류>기타 및 기능성' | 'custom'

// Define favorite item type
interface FavoriteItem {
  id: string;
  timestamp: number;
  character: string;
  analysis: string;
  itemType: string;
  dalleImageUrl: string;
  geminiImageUrl: string;
}

// 카테고리 타입 정의 추가
interface CategoryOption {
  value?: string;
  label: string;
  children?: CategoryOption[];
}

export default function Home() {
  const [character, setCharacter] = useState('')
  const [snsLink, setSnsLink] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [dalleImageUrl, setDalleImageUrl] = useState('')
  const [geminiImageUrl, setGeminiImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItemType>('상의>반소매 티셔츠')
  const [customItem, setCustomItem] = useState('')
  const [shopItems, setShopItems] = useState<{
    musinsa: ShopItem[],
    ably: ShopItem[]
  }>({
    musinsa: [],
    ably: []
  });
  
  // Favorites state
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [showFavorites, setShowFavorites] = useState(false)
  const [historyItems, setHistoryItems] = useState<FavoriteItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  
  // 카테고리 관련 상태와 상수 추가
  const CATEGORIES: CategoryOption[] = [
    { 
      label: '의류', 
      children: [
        { value: '상의>반소매 티셔츠', label: '반팔티' },
        { value: '상의>긴소매 티셔츠', label: '긴팔티' },
        { value: '하의>팬츠', label: '팬츠' },
        { value: '상의>맨투맨/스웨트셔츠', label: '맨투맨/스웨트셔츠' },
        { value: '상의>후드 티셔츠', label: '후드/집업' },
        { value: '의류>셔츠/블라우스', label: '셔츠/블라우스' },
        { value: '의류>니트/스웨터', label: '니트/스웨터' },
        { value: '의류>재킷/점퍼', label: '재킷/점퍼' },
        { value: '의류>가디건', label: '가디건' },
        { value: '의류>슈트', label: '슈트' },
        { value: '의류>코트', label: '코트' },
        { value: '의류>베스트', label: '베스트' },
        { value: '의류>패딩', label: '패딩' },
        { value: '의류>무스탕', label: '무스탕' },
        { value: '의류>플리스/후리스', label: '플리스/후리스' },
        { value: '의류>원피스', label: '원피스' },
        { value: '의류>기타 및 기능성', label: '기타 및 기능성' }
      ]
    },
    { 
      label: '신발', 
      children: [
        { value: '신발>스니커즈', label: '스니커즈' },
        { value: '신발>부츠/워커', label: '부츠/워커' },
        { value: '신발>구두', label: '구두' },
        { value: '신발>샌들/슬리퍼', label: '샌들/슬리퍼' }
      ]
    },
    { 
      label: '주얼리', 
      children: [
        { value: '주얼리>반지', label: '반지' },
        { value: '주얼리>목걸이/펜던트', label: '목걸이/펜던트' },
        { value: '주얼리>귀걸이', label: '귀걸이' },
        { value: '주얼리>팔찌/발찌', label: '팔찌/발찌' },
        { value: '주얼리>브로치/핀', label: '브로치/핀' },
        { value: '주얼리>시계', label: '시계' }
      ]
    },
    { 
      label: '패션잡화', 
      children: [
        { value: '패션잡화>모자', label: '모자' },
        { value: '패션잡화>가방', label: '가방' },
        { value: '패션잡화>안경', label: '안경' },
        { value: '패션잡화>스카프', label: '스카프' },
        { value: '패션잡화>양말', label: '양말' },
        { value: '패션잡화>목도리/머플러', label: '목도리/머플러' },
        { value: '패션잡화>벨트', label: '벨트' },
        { value: '패션잡화>지갑', label: '지갑' },
        { value: '패션잡화>장갑', label: '장갑' }
      ]
    }
  ];

  // 상태 추가
  const [selectedCategory, setSelectedCategory] = useState<string>('상의>반소매 티셔츠');
  const [loadingStep, setLoadingStep] = useState<string>('');

  // 오류 메시지 상태 추가
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 모든 상태를 초기화하는 함수
  const resetAll = () => {
    setCharacter('')
    setSnsLink('')
    setAnalysis('')
    setDalleImageUrl('')
    setGeminiImageUrl('')
    setSelectedItem('상의>반소매 티셔츠')
    setCustomItem('')
    setSelectedCategory('상의>반소매 티셔츠')
    setShopItems({
      musinsa: [],
      ably: []
    })
    resetOpenAIClient()
  }

  // Load favorites from localStorage on component mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favorites')
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites))
      } catch (e) {
        console.error('Error loading favorites:', e)
      }
    }
    
    const savedHistory = localStorage.getItem('designHistory')
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        // 로드 시에도 10개로 제한
        setHistoryItems(parsedHistory.slice(-10));
      } catch (e) {
        console.error('Error loading history:', e)
        // 에러 발생 시 히스토리 초기화
        localStorage.removeItem('designHistory');
        setHistoryItems([]);
      }
    }
  }, [])

  // Save favorites to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites))
  }, [favorites])
  
  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      // 히스토리가 10개를 초과하면 가장 오래된 항목들을 제거
      const limitedHistory = historyItems.slice(-10);
      localStorage.setItem('designHistory', JSON.stringify(limitedHistory));
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        // 스토리지가 가득 찼을 경우, 더 오래된 항목들을 제거
        const reducedHistory = historyItems.slice(-5); // 최근 5개만 유지
        try {
          localStorage.setItem('designHistory', JSON.stringify(reducedHistory));
          setHistoryItems(reducedHistory); // 상태도 업데이트
        } catch (retryError) {
          // 여전히 실패하면 모든 히스토리 삭제
          localStorage.removeItem('designHistory');
          setHistoryItems([]);
          console.error('Storage error:', e, retryError);
        }
      } else {
        console.error('Storage error:', e);
      }
    }
  }, [historyItems]);

  // Function to add current design to favorites
  const addToFavorites = () => {
    if (!dalleImageUrl) return
    
    const newFavorite: FavoriteItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      character,
      analysis,
      itemType: selectedItem === 'custom' ? customItem : selectedItem,
      dalleImageUrl: dalleImageUrl,
      geminiImageUrl: geminiImageUrl
    }
    
    setFavorites(prev => [newFavorite, ...prev])
  }
  
  // Function to remove from favorites
  const removeFromFavorites = (id: string) => {
    setFavorites(prev => prev.filter(item => item.id !== id))
  }
  
  // Function to load a favorite item
  const loadFavorite = (favorite: FavoriteItem) => {
    setCharacter(favorite.character)
    setAnalysis(favorite.analysis)
    setDalleImageUrl(favorite.dalleImageUrl)
    setGeminiImageUrl(favorite.geminiImageUrl)
    const validItemTypes: ItemType[] = ['상의>반소매 티셔츠', '상의>긴소매 티셔츠', '하의>팬츠', '상의>맨투맨/스웨트셔츠', '상의>후드 티셔츠', 
                          '의류>니트/스웨터', '신발>스니커즈', '주얼리>목걸이/펜던트', '패션잡화>모자', '패션잡화>가방'];
    
    if (validItemTypes.includes(favorite.itemType as ItemType)) {
      setSelectedItem(favorite.itemType as ItemType)
      setCustomItem('')
    } else {
      setSelectedItem('custom')
      setCustomItem(favorite.itemType)
    }
    setShowFavorites(false)
  }
  
  // Toggle favorites panel
  const toggleFavorites = () => {
    setShowFavorites(prev => !prev)
    if (showHistory) setShowHistory(false)
  }
  
  // Toggle history panel
  const toggleHistory = () => {
    setShowHistory(prev => !prev)
    if (showFavorites) setShowFavorites(false)
  }

  const handleAnalyze = async () => {
    if (!character.trim() && !snsLink.trim()) {
      alert('인물 정보나 SNS 링크를 입력해주세요');
      return;
    }

    try {
      setLoading(true)
      setLoadingStep('분석 중...')
      // 분석 시작 시 이전 결과들 초기화
      setAnalysis('')
      setDalleImageUrl('')
      setSelectedItem('상의>반소매 티셔츠')
      setCustomItem('')
      setGeminiImageUrl('')
      setShopItems({
        musinsa: [],
        ably: []
      })
      
      const result = await analyzeCharacter(character, snsLink)
      setAnalysis(result)
    } catch (error) {
      console.error('Error:', error)
      alert('분석 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  const handleGenerateImage = async () => {
    try {
      if (selectedItem === 'custom' && !customItem.trim()) {
        alert('아이템을 입력해주세요');
        return;
      }
      
      const itemType = selectedItem === 'custom' ? customItem : selectedItem;
      
      setLoading(true);
      setErrorMessage(''); // 오류 메시지 초기화
      
      // 병렬 작업 시작 전 첫 단계 로딩 메시지 설정
      setLoadingStep('DALL-E 이미지 생성 중...');
      
      try {
        // 공통 프롬프트 생성
        const prompt = createImagePrompt(analysis, itemType);
        
        // DALL-E 이미지 생성 (개별 실행하여 진행 상태 표시)
        const dalleImageUrl = await generateDalleImage(prompt);
        setDalleImageUrl(dalleImageUrl);
        
        // 생성된 URL이 에러 placeholder인지 확인
        if (dalleImageUrl.includes('placehold.co') || dalleImageUrl.includes('Image+Generation+Failed')) {
          setErrorMessage('이미지 생성에 실패했습니다. 다른 설명이나 상품을 선택해 주세요.');
        }
        
        // Gemini 이미지 생성 상태 메시지 업데이트
        setLoadingStep('Gemini 이미지 생성 중...');
        let geminiResult = '';
        try {
          // Gemini 이미지 생성
          geminiResult = await generateGeminiImage(prompt);
          
          // placeholder 이미지인지 확인
          const isGeminiFallback = geminiResult.includes('placehold.co');
          
          if (isGeminiFallback) {
            console.log('Gemini returned placeholder image');
            // Gemini가 실패했지만 폴백을 사용해 앱은 계속 작동
            setGeminiImageUrl(geminiResult);
          } else {
            // 정상적으로 Gemini 이미지를 받은 경우
            console.log('Gemini image generated successfully');
            setGeminiImageUrl(geminiResult);
          }
          
          // 히스토리에 추가 - 올바른 URL 사용
          const newHistoryItem: FavoriteItem = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            character,
            analysis,
            itemType,
            dalleImageUrl: dalleImageUrl,
            geminiImageUrl: geminiResult || 'https://placehold.co/1024x1024/f5f5f5/cccccc?text=Gemini+Image+Not+Available'
          }
          
          setHistoryItems(prev => {
            // 최근 20개 항목만 유지
            const updatedHistory = [newHistoryItem, ...prev];
            if (updatedHistory.length > 20) {
              return updatedHistory.slice(0, 20);
            }
            return updatedHistory;
          });
        } catch (geminiError: unknown) {
          console.error('Gemini API error:', geminiError);
          
          // 오류 메시지 표시
          const errorMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
          if (errorMessage.includes('safety') || 
              errorMessage.includes('Safety system') ||
              errorMessage.includes('policy')) {
            console.log('Gemini safety policy violation');
            // 오류 메시지 설정
            setErrorMessage('Gemini: 입력된 설명에 안전 정책을 위반하는 내용이 포함되어 있습니다.');
          } else {
            // 기타 오류 메시지
            console.log('Gemini generation error');
            setErrorMessage('Gemini 이미지 생성에 실패했습니다.');
          }
          
          // 플레이스홀더 이미지 URL 설정
          setGeminiImageUrl('https://placehold.co/1024x1024/f5f5f5/cccccc?text=Gemini+Image+Not+Available');
        }
        
        // 이미지 생성 이후 쇼핑몰 상품 검색 실행
        setLoadingStep('쇼핑몰 상품 검색 중...');
        try {
          const shopResults = await crawlShopItems(itemType, selectedCategory);
          setShopItems(shopResults);
        } catch (crawlError) {
          console.error('Error fetching shop items:', crawlError);
          setErrorMessage(prev => prev ? `${prev}\n상품 검색 중 오류가 발생했습니다.` : '상품 검색 중 오류가 발생했습니다.');
        }
      } catch (error: unknown) {
        console.error('General error:', error);
        setErrorMessage('처리 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
      }
    } catch (error: unknown) {
      console.error('General error:', error);
      setErrorMessage('처리 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // 카테고리 선택 처리 함수
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  // 크롤링 처리 함수 추가
  const handleCrawl = async () => {
    if (selectedItem && !loading) {
      const itemType = selectedItem === 'custom' ? customItem : selectedItem;
      
      setLoading(true);
      setLoadingStep('쇼핑몰 상품 검색 중...');
      try {
        const shopResults = await crawlShopItems(itemType, selectedCategory);
        setShopItems(shopResults);
      } catch (error) {
        console.error('Error fetching by category:', error);
        setErrorMessage('상품 검색 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
        setLoadingStep('');
      }
    }
  };

  // 아이템 타입 변경 처리 함수
  const handleItemTypeChange = (value: string) => {
    setSelectedItem(value as ItemType);
    if (value !== 'logo' && value !== 'custom') {
      setSelectedCategory(value);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // textarea인 경우 엔터키만으로는 실행하지 않음
      if (e.currentTarget.tagName.toLowerCase() === 'textarea') {
        if (e.ctrlKey) { // Ctrl+Enter로 실행
          handleGenerateImage();
        }
        return;
      }
      
      // input field인 경우 엔터키로 실행
      if (!loading && (character.trim() || snsLink.trim())) {
        handleAnalyze();
      }
    }
  };

  // 이미지 오류 처리를 위한 함수 추가
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = 'https://image.msscdn.net/images/no_image_125.png'; // 무신사 기본 이미지
  };

  // 로딩 컴포넌트
  const LoadingIndicator = () => (
    <div className="flex flex-col items-center justify-center h-[400px] sm:h-[600px] bg-white rounded-lg shadow">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src="/bling-logo.png"
              alt="BLING"
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
          </div>
        </div>
        <p className="font-medium text-lg text-gray-700 mt-4 mb-2">{loadingStep || '처리중...'}</p>
        <div className="flex space-x-1 justify-center">
          <div className={`w-2 h-2 rounded-full ${loadingStep.includes('분석') ? 'bg-blue-500' : 'bg-gray-300'} animate-pulse`}></div>
          <div className={`w-2 h-2 rounded-full ${loadingStep.includes('DALL-E') ? 'bg-blue-500' : 'bg-gray-300'} animate-pulse delay-100`}></div>
          <div className={`w-2 h-2 rounded-full ${loadingStep.includes('Gemini') ? 'bg-blue-500' : 'bg-gray-300'} animate-pulse delay-200`}></div>
          <div className={`w-2 h-2 rounded-full ${loadingStep.includes('쇼핑몰') ? 'bg-blue-500' : 'bg-gray-300'} animate-pulse delay-300`}></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center">
          <button 
            onClick={resetAll}
            className="flex items-center hover:opacity-80 transition-opacity mb-2 sm:mb-0"
          >
            <Image
              src="/bling-logo.png" 
              alt="BLING.CO" 
              width={160} 
              height={48} 
              priority
              className="w-auto h-auto"
            />
          </button>
          
          <div className="flex space-x-2">
            <button
              onClick={toggleFavorites}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm sm:text-base font-medium ${showFavorites ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              즐겨찾기
            </button>
            <button
              onClick={toggleHistory}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm sm:text-base font-medium ${showHistory ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              히스토리
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Favorites Panel (Conditionally Rendered) */}
        {showFavorites && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">내 즐겨찾기</h2>
              <button 
                onClick={() => setShowFavorites(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </button>
            </div>
            
            {favorites.length === 0 ? (
              <p className="text-gray-500 text-center py-8">즐겨찾기한 디자인이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {favorites.map(favorite => (
                  <div key={favorite.id} className="border rounded-lg overflow-hidden relative">
                    <button 
                      onClick={() => removeFromFavorites(favorite.id)}
                      className="absolute top-2 right-2 bg-white p-1 rounded-full shadow z-10"
                    >
                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => loadFavorite(favorite)}
                      className="w-full"
                    >
                      <div className="aspect-square relative">
                        <img 
                          src={favorite.dalleImageUrl} 
                          alt="Favorite design" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-gray-500 truncate">{new Date(favorite.timestamp).toLocaleDateString()}</p>
                        <p className="text-sm font-medium truncate">{favorite.itemType}</p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* History Panel (Conditionally Rendered) */}
        {showHistory && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">생성 히스토리</h2>
              <button 
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </button>
            </div>
            
            {historyItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">생성 히스토리가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {historyItems.map(item => (
                  <div key={item.id} className="border rounded-lg overflow-hidden relative">
                    <button 
                      onClick={() => loadFavorite(item)}
                      className="w-full"
                    >
                      <div className="aspect-square relative">
                        <img 
                          src={item.dalleImageUrl} 
                          alt="History design" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-gray-500 truncate">{new Date(item.timestamp).toLocaleDateString()}</p>
                        <p className="text-sm font-medium truncate">{item.itemType}</p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar */}
          <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <label className="block mb-2 font-medium text-gray-700">분석할 인물:</label>
              <input
                type="text"
                value={character}
                onChange={(e) => setCharacter(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full p-2 border rounded text-black mb-3"
                placeholder="인물 이름이나 설명을 입력하세요"
              />
              <label className="block mb-2 font-medium text-gray-700">SNS 링크 (선택):</label>
              <input
                type="text"
                value={snsLink}
                onChange={(e) => setSnsLink(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full p-2 border rounded text-black mb-3"
                placeholder="인스타그램, 트위터 등의 링크를 입력하세요"
              />
              <button
                onClick={handleAnalyze}
                disabled={loading || (!character.trim() && !snsLink.trim())}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
              >
                분석하기
              </button>
            </div>

            {analysis && (
              <div className="bg-white p-4 rounded-lg shadow">
                <label className="block mb-2 font-medium text-gray-700">분석 결과 (수정 가능):</label>
                <textarea
                  value={analysis}
                  onChange={(e) => setAnalysis(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="w-full p-2 border rounded h-40 text-black mb-3"
                  placeholder="Ctrl+Enter를 눌러 이미지를 생성하세요"
                />
                <div className="mb-3">
                  <label className="block mb-2 font-medium text-gray-700">추천 패션 아이템:</label>
                  <select
                    value={selectedItem}
                    onChange={(e) => handleItemTypeChange(e.target.value)}
                    className="w-full p-2 border rounded text-black mb-2"
                  >
                    {CATEGORIES.map((category) => (
                      category.children && (
                        <optgroup key={category.label} label={category.label}>
                          {category.children.map(subCategory => (
                            <option key={subCategory.value} value={subCategory.value}>
                              {subCategory.label}
                            </option>
                          ))}
                        </optgroup>
                      )
                    ))}
                    <option value="custom">직접 입력</option>
                  </select>
                  {selectedItem === 'custom' && (
                    <input
                      type="text"
                      value={customItem}
                      onChange={(e) => setCustomItem(e.target.value)}
                      className="w-full p-2 border rounded text-black"
                      placeholder="원하는 아이템을 입력하세요"
                    />
                  )}
                </div>
                <button
                  onClick={handleGenerateImage}
                  disabled={loading || !analysis || (selectedItem === 'custom' && !customItem)}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
                >
                  이미지 생성하기
                </button>
              </div>
            )}

            {/* 카테고리 선택 */}
            <div className="bg-white p-4 rounded-lg shadow mt-4">
              <label className="block mb-2 font-medium text-gray-700">카테고리 선택:</label>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full p-2 border rounded text-black mb-2"
              >
                {CATEGORIES.map((category) => (
                  category.children ? (
                    <optgroup key={category.label} label={category.label}>
                      {category.children.map(subCategory => (
                        <option key={subCategory.value} value={subCategory.value}>
                          {subCategory.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : category.value && (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  )
                ))}
              </select>
              <button
                onClick={handleCrawl}
                disabled={loading || (!selectedItem) || (selectedItem === 'custom' && !customItem)}
                className="w-full mt-2 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-300"
              >
                상품 검색하기
              </button>
              <p className="text-xs text-gray-500 mt-1">버튼을 클릭하면 해당 카테고리의 인기 상품을 보여줍니다.</p>
            </div>
          </div>

          {/* Main Content Area 수정 */}
          <div className="flex-1">
            {loading ? (
              <LoadingIndicator />
            ) : (
              <div className="flex flex-col lg:flex-row gap-4">
                {/* 모바일에서는 AI 이미지가 먼저 표시되도록 순서 변경 */}
                {/* AI 생성 이미지들 (모바일에서는 전체 너비) */}
                <div className="w-full lg:w-1/3 space-y-4 order-1 lg:order-2">
                  {/* DALL-E 이미지 */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">DALL-E 디자인</h3>
                      {dalleImageUrl && !dalleImageUrl.includes('placehold.co') && (
                        <button 
                          onClick={addToFavorites}
                          className="text-blue-500 hover:text-blue-700 flex items-center text-sm"
                          aria-label="현재 디자인을 즐겨찾기에 추가"
                        >
                          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          즐겨찾기
                        </button>
                      )}
                    </div>
                    {dalleImageUrl && dalleImageUrl.includes('placehold.co') && (
                      <div className="mb-4 p-3 border border-red-200 bg-red-50 rounded-lg text-red-600 text-sm" role="alert">
                        <p>이미지 생성에 실패했습니다. 다른 설명이나 상품을 선택해 주세요.</p>
                      </div>
                    )}
                    {errorMessage && (
                      <div className="mb-4 p-3 border border-red-200 bg-red-50 rounded-lg text-red-600 text-sm" role="alert">
                        {errorMessage}
                      </div>
                    )}
                    {dalleImageUrl ? (
                      <div className="flex justify-center">
                        <img 
                          src={dalleImageUrl} 
                          alt={`${selectedItem === 'custom' ? customItem : selectedItem} 디자인 이미지`}
                          className="w-full rounded-lg shadow-lg"
                          loading="eager"
                          onError={(e) => {
                            console.error("Failed to load DALL-E image");
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = `
                              <div class="h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg p-4">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p>이미지 로딩에 실패했습니다</p>
                                <button class="mt-3 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600" onclick="location.reload()">새로고침</button>
                              </div>
                            `;
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                        {loading ? (
                          <>
                            <div className="animate-pulse mb-3 rounded-full h-12 w-12 border-2 border-gray-200 border-t-blue-500 animate-spin"></div>
                            <p>DALL-E 이미지 생성 중...</p>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p>DALL-E 이미지가 여기에 표시됩니다</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Gemini 이미지 */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Gemini 디자인</h3>
                      {/* Fallback indicator */}
                      {geminiImageUrl && geminiImageUrl.includes('placehold.co') && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          이미지 생성 실패
                        </span>
                      )}
                    </div>
                    {geminiImageUrl && geminiImageUrl.includes('placehold.co') && (
                      <div className="mb-4 p-3 border border-amber-200 bg-amber-50 rounded-lg text-amber-600 text-sm" role="alert">
                        <p>Gemini 이미지 생성에 실패했습니다. 다른 설명이나 상품을 선택해 주세요.</p>
                      </div>
                    )}
                    {!geminiImageUrl && dalleImageUrl && (
                      <div className="mb-4 p-3 border border-amber-200 bg-amber-50 rounded-lg text-amber-600 text-sm" role="alert">
                        Gemini 이미지 생성을 건너뛰었습니다.
                      </div>
                    )}
                    {geminiImageUrl ? (
                      <div className="flex justify-center">
                        <img 
                          src={geminiImageUrl} 
                          alt={`${selectedItem === 'custom' ? customItem : selectedItem} Gemini 디자인 이미지`}
                          className="w-full rounded-lg shadow-lg"
                          loading="lazy"
                          onError={(e) => {
                            console.error("Failed to load Gemini image");
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = `
                              <div class="h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg p-4">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p>Gemini 이미지 로딩에 실패했습니다</p>
                                <button class="mt-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600" onclick="location.reload()">새로고침</button>
                              </div>
                            `;
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                        {loading ? (
                          <>
                            <div className="animate-pulse mb-3 rounded-full h-12 w-12 border-2 border-gray-200 border-t-green-500 animate-spin"></div>
                            <p>Gemini 이미지 생성 중...</p>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p>Gemini 이미지가 여기에 표시됩니다</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 쇼핑몰 상품들 (모바일에서는 전체 너비) */}
                <div className="w-full lg:w-2/3 bg-white rounded-lg shadow p-4 order-2 lg:order-1">
                  <h2 className="text-xl font-bold mb-4 text-gray-700">추천 상품</h2>
                  
                  {/* 무신사 */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">무신사 랭킹</h3>
                    {shopItems.musinsa.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {shopItems.musinsa.map(item => (
                          <a 
                            key={item.id} 
                            href={item.url} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow relative"
                          >
                            {item.rank && (
                              <div className="absolute top-0 left-0 bg-blue-600 text-white w-8 h-8 flex items-center justify-center font-bold rounded-tl-lg z-10">
                                {item.rank}
                              </div>
                            )}
                            <div className="aspect-square relative">
                              <img 
                                src={item.image || 'https://image.msscdn.net/images/no_image_125.png'} 
                                alt={item.title} 
                                className="w-full h-full object-cover"
                                onError={handleImageError}
                                loading="lazy"
                              />
                            </div>
                            <div className="p-3">
                              {item.brand && (
                                <p className="text-xs text-gray-500 mb-1">{item.brand}</p>
                              )}
                              <h4 className="font-medium text-sm mb-1 line-clamp-2 h-10">{item.title}</h4>
                              <p className="text-sm font-bold text-gray-900">{item.price}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="flex justify-center items-center h-40 bg-gray-50 rounded-lg">
                        <p className="text-gray-400">검색 결과가 없습니다</p>
                      </div>
                    )}
                  </div>
                  
                  {/* 에이블리 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">에이블리</h3>
                    {shopItems.ably.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {shopItems.ably.map(item => (
                          <a 
                            key={item.id} 
                            href={item.url} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                          >
                            <div className="aspect-square relative">
                              <img 
                                src={item.image || 'https://image.msscdn.net/images/no_image_125.png'} 
                                alt={item.title} 
                                className="w-full h-full object-cover"
                                onError={handleImageError}
                                loading="lazy"
                              />
                            </div>
                            <div className="p-3">
                              {item.brand && (
                                <p className="text-xs text-gray-500 mb-1">{item.brand}</p>
                              )}
                              <h4 className="font-medium text-sm mb-1 line-clamp-2 h-10">{item.title}</h4>
                              <p className="text-sm font-bold text-gray-900">{item.price}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="flex justify-center items-center h-40 bg-gray-50 rounded-lg">
                        <p className="text-gray-400">검색 결과가 없습니다</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
