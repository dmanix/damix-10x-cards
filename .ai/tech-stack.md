Frontend - Astro z React dla komponentów interaktywnych:
- Astro 5 pozwala na tworzenie szybkich, wydajnych stron i aplikacji z minimalną ilością JavaScript
- React 19 zapewni interaktywność tam, gdzie jest potrzebna
- TypeScript 5 dla statycznego typowania kodu i lepszego wsparcia IDE
- Tailwind 4 pozwala na wygodne stylowanie aplikacji
- Shadcn/ui zapewnia bibliotekę dostępnych komponentów React, na których oprzemy UI

Backend - Supabase jako kompleksowe rozwiązanie backendowe:
- Zapewnia bazę danych PostgreSQL
- Zapewnia SDK w wielu językach, które posłużą jako Backend-as-a-Service
- Jest rozwiązaniem open source, które można hostować lokalnie lub na własnym serwerze
- Posiada wbudowaną autentykację użytkowników

AI - Komunikacja z modelami przez usługę Openrouter.ai:
- Dostęp do szerokiej gamy modeli (OpenAI, Anthropic, Google i wiele innych), które pozwolą nam znaleźć rozwiązanie zapewniające wysoką efektywność i niskie koszta
- Pozwala na ustawianie limitów finansowych na klucze API

CI/CD i Hosting:
- Github Actions do tworzenia pipeline’ów CI/CD
- DigitalOcean do hostowania aplikacji za pośrednictwem obrazu docker

Testy:
- Testy jednostkowe i integracyjne:
  - Vitest + @vitest/coverage-v8 + @vitest/ui - nowoczesne narzędzie do testów jednostkowych z natywnym wsparciem dla Vite/Astro, 5-10x szybsze niż Jest
  - MSW 2.x (Mock Service Worker) - mockowanie HTTP/OpenRouter/Supabase w testach z nowoczesnym API opartym na fetch
  - Zod - walidacja schematów (już w projekcie)

- Testy E2E (end-to-end):
  - Playwright - testy UI i API w przeglądarce z wbudowanym auto-waiting, trace viewer i wsparciem dla wielu przeglądarek (Chromium/Firefox/WebKit)
  - @axe-core/playwright - automatyczne testy accessibility (a11y) zintegrowane z testami E2E

- Testy API i weryfikacja manualna:
  - Bruno - git-friendly, offline-first narzędzie do testowania API (nowoczesna alternatywa dla Postman, z collections w repozytorium)