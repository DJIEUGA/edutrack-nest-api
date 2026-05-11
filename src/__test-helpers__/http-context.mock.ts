export function buildMockArgumentsHost(
  overrides: { correlationId?: string; xRequestId?: string } = {},
) {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const request = {
    correlationId: overrides.correlationId,
    headers: { 'x-request-id': overrides.xRequestId },
  };
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as any,
    response,
    request,
  };
}
