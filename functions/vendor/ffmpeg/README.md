# FFmpeg runtime

O binário não é versionado. O predeploy executa
`scripts/install-wall-media-ffmpeg.cjs` em qualquer host, baixa do mirror
imutável do projeto o build Linux x64 LGPL pinado do BtbN indicado pela página
oficial de downloads do FFmpeg e valida SHA-256 do archive e do executável antes
de incluí-lo no source bundle. Em Linux x64, também executa o binário e exige
FFmpeg 8.1.2 antes de instalar `ffmpeg` nesta pasta.

Em macOS, o binário Linux é validado pelos hashes durante o empacotamento; testes
e Emulator usam `/opt/homebrew/bin/ffmpeg`, também validado com piso mínimo
8.1.2. O diretório `vendor/ffmpeg` deve permanecer fora da lista `ignore` do
bloco Functions em `firebase.json`, para que o empacotador inclua o artefato
gerado mesmo ele estando no `.gitignore`. Produção não possui fallback para
`PATH`.
