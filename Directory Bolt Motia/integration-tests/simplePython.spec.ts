import { createMotiaTester } from '@motiadev/test'

describe('simplePython', () => {
  let server: ReturnType<typeof createMotiaTester>

  beforeEach(async () => (server = createMotiaTester()))
  afterEach(async () => server.close())

  it('should run steps concurrently', async () => {
    // Creating a watcher for the event we want to test
    const testedEvent = await server.watch('tested')

    const response = await server.post('/test-python', {
      body: { message: 'Start simple python test' },
    })
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ message: 'payload processed' })

    // This is important to ensure all events are handled in this test
    await server.waitEvents()

    // Checking all captured events
    expect(testedEvent.getCapturedEvents()).toHaveLength(1)

    // Checking the last captured event
    expect(testedEvent.getLastCapturedEvent()).toEqual({
      traceId: expect.any(String),
      topic: 'tested',
      flows: ['simple-python'],
      data: { message: 'hello world', enriched: 'yes' },
    })
  })
})
