# MuitoHentai — Addon para Stremio/Nuvio

Addon comunitário que indexa o conteúdo público do [MuitoHentai](https://www.muitohentai.com/) sem hospedar os vídeos. Ele foi feito para que os títulos sejam apresentados como **séries**, com cada episódio separado, e para que os dois servidores publicados na página do episódio apareçam individualmente.

## Recursos

- Catálogos de lançamentos, todos os títulos, sem censura, Harem, Romance, Fantasia e Ação.
- Pesquisa pelo nome do título no Stremio/Nuvio.
- Organização correta como `series`, com temporada 1 e episódios numerados separadamente.
- O servidor **Alternativo** é convertido para um stream MP4 interno do addon, com suporte a `Range`/seek, para reprodução dentro do Stremio/Nuvio.
- O servidor **Principal** atualmente é um iframe Blogger sem URL MP4/HLS pública; por isso ele continua marcado como abertura externa. O addon não inventa uma URL direta quando o provedor não a entrega.
- Cache curto no servidor para reduzir requisições ao site-fonte.

## Deploy no Render via GitHub

1. Crie um repositório no GitHub e envie `server.js`, `package.json`, `render.yaml` e este `README.md`.
2. No Render, escolha **New > Web Service** e conecte o repositório.
3. Use o plano gratuito ou o plano desejado. O Render utilizará o comando `npm start` e a porta fornecida pela variável `PORT`.
4. Ao finalizar, copie a URL do serviço, por exemplo `https://muito-hentai-addon.onrender.com`.

Também é possível usar o Blueprint do Render: o arquivo `render.yaml` já define o serviço e o comando de inicialização.

## Instalação no Stremio/Nuvio

Abra a área de addons e cole:

```text
https://SEU-SERVICO.onrender.com/manifest.json
```

Depois de instalar, os catálogos aparecerão com o prefixo **MuitoHentai -**. Entre em um título para ver a lista de episódios e escolha **Principal** ou **Alternativo**.

Para assistir dentro do aplicativo, escolha **Alternativo — MP4 direto**. A opção Principal depende do player Blogger do site-fonte e pode abrir externamente.

## Observações

O addon não baixa, retransmite ou armazena vídeos. Ele consulta metadados públicos e entrega ao Stremio os iframes dos servidores indicados pelo site-fonte. O funcionamento pode variar se o site alterar suas rotas, exigir login ou bloquear requisições do Render. Use o addon de acordo com a legislação aplicável e os termos do site-fonte.
