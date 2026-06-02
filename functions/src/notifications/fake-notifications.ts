export interface FakeGame {
  title: string;
  body: (params: Record<string, string>) => string;
  time: string;
  location: string;
}

export const FAKE_GAME_INVITES: readonly FakeGame[] = [
  {
    title: "Pelada de Sexta!",
    body: (p) =>
      `${p.userName}, você foi convidado(a) para a pelada de sexta às 18h!`,
    time: "Sexta, 18:00",
    location: "Campo do Clube",
  },
  {
    title: "Futebol no Sábado",
    body: (p) =>
      `Vem jogar ${p.userName}! Sábado às 10h no campo society.`,
    time: "Sábado, 10:00",
    location: "Society Center",
  },
  {
    title: "Domingo de Bola",
    body: (p) =>
      `Domingo tem jogo! ${p.userName}, confirma aí?`,
    time: "Domingo, 09:00",
    location: "Quadra do Parque",
  },
  {
    title: "Pelada Noturna",
    body: (p) =>
      `Hoje à noite ${p.userName}! 20h na quadra iluminada.`,
    time: "Hoje, 20:00",
    location: "Quadra Iluminada",
  },
  {
    title: "Campeonato Interno",
    body: (p) =>
      `Seu grupo está organizando um campeonato. ${p.userName}, participe!`,
    time: "Próximo sábado",
    location: "Centro Esportivo",
  },
] as const;

export function getFakeGame(index: number): FakeGame | undefined {
  return FAKE_GAME_INVITES[index];
}
