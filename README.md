# Central de Demandas

PWA pessoal para organizar demandas de suporte tecnico e infraestrutura.

Link publicado: https://central-demandas-pessoal.web.app

## Objetivo

A Central de Demandas foi criada para registrar chamados, pendencias, testes realizados e proximos passos durante a rotina de trabalho em suporte tecnico/TI.

O foco do projeto e ser:

- leve
- offline-first
- simples de usar
- rapido em notebook antigo
- util como historico/evidencia de atividades

## Funcionalidades

- Kanban simplificado com quatro colunas
- Demanda rapida no topo
- Edicao completa de demanda
- Campo "O que ja foi feito"
- Campo "Proximo passo"
- Observacoes tecnicas
- Historico da demanda
- Busca e filtros
- Copiar resumo para WhatsApp ou relatorio
- Modo claro/escuro
- Exportar backup JSON
- Mesclar backup JSON sem apagar dados locais
- Substituir backup JSON com confirmacao
- Funcionamento offline via service worker

## Tecnologias

- HTML
- CSS
- JavaScript puro
- Vite
- Firebase Hosting
- localStorage

Sem React, sem backend obrigatorio e sem bibliotecas pesadas.

## Rodar localmente

```bash
npm install
npm run dev
```

## Gerar versao final

```bash
npm run build
npm run start
```

## Publicar no Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

## Sobre sincronizacao

Atualmente os dados ficam no navegador usando `localStorage`.

Para usar em outro aparelho sem perder informacoes, use:

1. Exportar JSON no aparelho de origem.
2. Abrir o app no outro aparelho.
3. Usar "Mesclar JSON".

Sincronizacao automatica entre celular e PC pode ser adicionada futuramente com Firebase Authentication e Firestore.

## Roadmap

- Sincronizacao opcional com Firebase Firestore
- Login pessoal opcional
- Anexos/fotos via Firebase Storage
- Relatorio por periodo
- Impressao/exportacao em PDF
