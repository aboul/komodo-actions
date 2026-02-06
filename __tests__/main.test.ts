/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
/**
 * Unit tests for src/main.ts
 */
import { jest } from '@jest/globals'

// --- Mock du module core ---
import * as core from '../__fixtures__/core.js'
jest.unstable_mockModule('@actions/core', () => core)

// --- Mock du module fs/promises pour writeFile ---
const mockWriteFile = jest.fn()
jest.unstable_mockModule('node:fs/promises', () => ({
  writeFile: mockWriteFile
}))

// --- Mock du client Komodo ---
const mockExecuteAndPoll: any = jest.fn()
jest.unstable_mockModule('komodo_client', () => ({
  KomodoClient: jest.fn().mockImplementation(() => ({
    execute_and_poll: (...args: any[]) => mockExecuteAndPoll(...args)
  }))
}))

// --- Import dynamique après les mocks ---
const { run, executeOne } = await import('../src/main.ts')

// --- Helpers pour les updates ---
import { Update, UpdateStatus, Operation } from 'komodo_client/dist/types.js'

type MockInputsOptions = {
  kind?: 'stack' | 'service' | 'procedure'
  patterns?: string[]
  dryRun?: boolean
  komodoUrl?: string
  apiKey?: string
  apiSecret?: string
}

function mockInputs({
  kind = 'stack',
  patterns = ['test-stack'],
  dryRun = false,
  komodoUrl = 'https://komodo.example.com',
  apiKey = 'fake-key',
  apiSecret = 'fake-secret'
}: MockInputsOptions = {}) {
  core.getInput.mockImplementation((name: string) => {
    switch (name) {
      case 'kind':
        return kind
      case 'patterns':
        return JSON.stringify(patterns)
      case 'dry-run':
        return dryRun ? 'true' : 'false'
      case 'komodo-url':
        return komodoUrl
      case 'api-key':
        return apiKey
      case 'api-secret':
        return apiSecret
      default:
        return ''
    }
  })
}

function makeUpdate(oid: string): Update {
  return {
    _id: { $oid: oid },
    status: UpdateStatus.Complete,
    operation: Operation.DeployStack,
    start_ts: 0,
    success: true,
    operator: 'test',
    target: { type: 'Stack', id: '123' },
    logs: []
  }
}

// --- Tests ---
describe('Komodo Deploy Action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    process.env.GITHUB_STEP_SUMMARY = '/tmp/summary.md'

    // Mock inputs par défaut
    mockInputs()

    // Mock par défaut du client Komodo
    mockExecuteAndPoll.mockResolvedValue([makeUpdate('123test')])
  })

  afterEach(() => {
    delete process.env.GITHUB_STEP_SUMMARY
  })

  it('sets updates output correctly', async () => {
    await run()

    expect(core.setOutput).toHaveBeenCalledWith('updates', {
      '123test': 'Complete'
    })

    // Vérifie que le résumé a été écrit
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/summary.md',
      expect.stringContaining('| 123test | Complete |'),
      { flag: 'a' }
    )
    const markdownWritten = mockWriteFile.mock.calls[0][1] as string
    expect(markdownWritten).toContain('| 123test | Complete |')
  })

  it('handles dry-run correctly', async () => {
    mockInputs({ dryRun: true })

    await run()

    // Komodo client ne doit pas être appelé
    expect(mockExecuteAndPoll).not.toHaveBeenCalled()
    expect(core.setOutput).toHaveBeenCalledWith('updates', {})
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('marks action as failed on Komodo error', async () => {
    mockExecuteAndPoll.mockImplementationOnce(() =>
      Promise.reject(new Error('Komodo error'))
    )

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('Komodo error')
  })

  it('throw for undefined komodo api inputs', async () => {
    mockInputs({ apiKey: '' })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Komodo URL / API key / API secret must be provided either via input or env'
    )
  })

  it('throw for empty pattern', async () => {
    mockInputs({ patterns: [] })

    await run()

    expect(core.setOutput).toHaveBeenCalledWith(
      'updates',
      'Nothing to update here'
    )
  })

  it('executeOne calls correct endpoint for stack and procedure', async () => {
    const client: any = { execute_and_poll: jest.fn() }

    await executeOne(client, 'stack', 'my-stack')
    expect(client.execute_and_poll).toHaveBeenCalledWith('DeployStack', {
      stack: 'my-stack'
    })

    await executeOne(client, 'procedure', 'my-proc')
    expect(client.execute_and_poll).toHaveBeenCalledWith('RunProcedure', {
      procedure: 'my-proc'
    })
  })

  it('throws for unsupported kind', async () => {
    const client: any = { execute_and_poll: jest.fn() }
    await expect(executeOne(client, 'service' as any, 'foo')).rejects.toThrow(
      'Unsupported kind'
    )
  })
})
