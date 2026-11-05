/**
 * Instância única do FakeStore usada pelos testes de ouro do XP (A1).
 * Fica num módulo próprio para que a factory do jest.mock e o corpo do
 * teste recebam o mesmo objeto (mesmo registro de módulos do arquivo).
 */
import {FakeStore} from "./fake-firestore";

export const sharedStore = new FakeStore();
