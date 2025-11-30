// This is a sample API Step to demonstrate the structure
export const config = {
  name: 'HelloWorld',
  type: 'api',
  path: '/hello',
  method: 'GET'
};

export const handler = async (req: any, { logger }: { logger: any }) => {
  logger.info('Hello World endpoint accessed');
  return { 
    status: 200, 
    body: { 
      message: 'Hello from Directory Bolt powered by Motia!',
      timestamp: new Date().toISOString()
    } 
  };
};