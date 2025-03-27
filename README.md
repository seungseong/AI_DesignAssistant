# BLING.CO - AI 패션 아이템 디자이너

AI 기반 맞춤형 상품 디자인 및 쇼핑 추천 플랫폼입니다. 사용자의 특성을 분석하여 개인화된 디자인을 생성하고, 한국의 주요 쇼핑몰에서 관련 상품을 추천합니다.

## 주요 기능

- **AI 분석**: 사용자의 특성이나 SNS 링크를 분석하여 개인화된 스타일 특성을 파악합니다.
- **디자인 생성**: OpenAI의 DALL-E와 Google의 Gemini 모델을 활용하여 다양한 상품 디자인을 생성합니다.
- **상품 추천**: 무신사, 네이버 스마트스토어, 에이블리/지그재그에서 관련 상품을 스크래핑하여 추천합니다.
- **즐겨찾기 기능**: 생성된 디자인을 즐겨찾기하고 나중에 다시 볼 수 있습니다.
- **히스토리 저장**: 생성된 디자인 히스토리를 자동으로 저장하여 이전 결과를 확인할 수 있습니다.
- **카테고리 필터링**: 무신사 카테고리별 인기 상품을 필터링하여 볼 수 있습니다.
- **다양한 상품 유형**: 티셔츠, 후드티, 머그컵, 백팩, 모자, 신발 등 다양한 상품 디자인을 지원합니다.
- **반응형 디자인**: 모바일 및 데스크톱 환경에 최적화된 UI를 제공합니다.

## 시작하기

### 필수 환경 변수

`.env.local` 파일을 생성하고 다음 API 키를 설정해야 합니다:

```
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

### 설치 및 실행

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 애플리케이션을 확인할 수 있습니다.

## 기술 스택

- **프레임워크**: Next.js
- **스타일링**: Tailwind CSS
- **AI 모델**: OpenAI DALL-E 3, Google Gemini
- **웹 스크래핑**: Cheerio
- **상태 관리**: React Hooks
- **API 통신**: Axios

## 참고 사항

- 이 프로젝트는 학습 및 데모 목적으로 개발되었습니다.
- 스크래핑 기능은 해당 웹사이트의 정책에 따라 제한될 수 있습니다.
- API 키는 사용량에 따라 비용이 발생할 수 있으니 유의하세요.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# AI_DesignAssistant
