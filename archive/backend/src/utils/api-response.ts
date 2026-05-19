import { Response } from 'express';

export interface ApiResponseData<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

export class ApiResponse {
  static success<T>(res: Response, data: T, statusCode: number = 200): Response {
    return res.status(statusCode).json({
      success: true,
      data,
    });
  }

  static created<T>(res: Response, data: T): Response {
    return this.success(res, data, 201);
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 400,
    errors?: any[]
  ): Response {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  }

  static unauthorized(res: Response, message: string = 'Não autorizado'): Response {
    return this.error(res, message, 401);
  }

  static forbidden(res: Response, message: string = 'Acesso negado'): Response {
    return this.error(res, message, 403);
  }

  static notFound(res: Response, message: string = 'Recurso não encontrado'): Response {
    return this.error(res, message, 404);
  }

  static internalError(res: Response, message: string = 'Erro interno do servidor'): Response {
    return this.error(res, message, 500);
  }
}
