import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(ex: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status = ex instanceof HttpException ? ex.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const prod = process.env.NODE_ENV === 'production';
    const body =
      ex instanceof HttpException
        ? (ex.getResponse() as any)
        : { message: 'Internal server error' };
    res.status(status).json({
      statusCode: status,
      // Produksi: jangan bocorkan stack/SQL/path — AGENTS §10, PRD §18.
      message: status === 500 && prod ? 'Internal server error' : (body?.message ?? body),
      ...(typeof body === 'object' && body?.code ? { code: body.code } : {}),
    });
  }
}
