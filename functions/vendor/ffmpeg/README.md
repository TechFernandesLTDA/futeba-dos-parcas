# FFmpeg runtime

O binário não é versionado. `npm install`/`npm ci` executa
`scripts/install-wall-media-ffmpeg.cjs` em Linux x64, baixa do mirror imutável
do projeto o build LGPL pinado do BtbN indicado pela página oficial de downloads
do FFmpeg, valida SHA-256 do archive e do executável antes de executá-lo e exige
FFmpeg 8.1.2 antes de instalar `ffmpeg` nesta pasta.

Em macOS, testes e Emulator usam `/opt/homebrew/bin/ffmpeg`, também validado
com piso mínimo 8.1.2. Produção não possui fallback para `PATH`.
