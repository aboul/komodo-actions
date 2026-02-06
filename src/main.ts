import * as core from '@actions/core'
import { writeFile } from 'node:fs/promises'
import { KomodoClient } from 'komodo_client'
import type {
  Update,
  BatchExecutionResponseItemErr
} from 'komodo_client/dist/types.js'

/**
 * Union type returned by Komodo batch / execution endpoints
 */
export type UpdateItem =
  | Update
  | (Update | { status: 'Err'; data: BatchExecutionResponseItemErr })

type UpdateResult = UpdateItem | UpdateItem[]

/**
 * Type guard:
 * - filters out "Err" objects
 * - ensures Update has a Mongo ObjectId with $oid
 */
function hasOid(item: UpdateItem): item is Update & { _id: { $oid: string } } {
  return (
    'operation' in item && // discriminate Update vs Err
    typeof item._id?.$oid === 'string'
  )
}

async function writeStepSummary(updateStatusMap: Record<string, string>) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (!summaryFile) return

  let markdown = `### 📝 Komodo Deployment Summary\n\n`
  markdown += `| Update ID | Status |\n`
  markdown += `|-----------|--------|\n`

  for (const [id, status] of Object.entries(updateStatusMap)) {
    markdown += `| ${id} | ${status} |\n`
  }

  await writeFile(summaryFile, markdown, { flag: 'a' }) // 'a' = append
}

/**
 * Execute a single Komodo operation depending on the resource kind
 */
export async function executeOne(
  client: ReturnType<typeof KomodoClient>,
  kind: 'stack' | 'procedure',
  name: string
): Promise<UpdateResult> {
  switch (kind) {
    case 'stack':
      return client.execute_and_poll('DeployStack', { stack: name })

    case 'procedure':
      return client.execute_and_poll('RunProcedure', { procedure: name })

    default:
      throw new Error(`Unsupported kind: ${kind}`)
  }
}

/**
 * Main entrypoint of the GitHub Action
 */
export async function run(): Promise<void> {
  try {
    // ---- Inputs -------------------------------------------------------------

    const kind = core.getInput('kind', { required: true }) as
      | 'stack'
      | 'procedure'

    const rawPatterns = core.getInput('patterns', { required: true })
    const dryRun = core.getInput('dry-run') === 'true'

    const patterns: string[] = JSON.parse(rawPatterns)

    if (!Array.isArray(patterns) || patterns.length === 0) {
      core.setOutput('updates', 'Nothing to update here')
    }

    core.info(`Kind: ${kind}`)
    core.info(`Targets: ${patterns.join(', ')}`)

    if (dryRun) {
      core.info('🧪 Dry-run enabled, nothing will be deployed')
      core.setOutput('updates', {})
      return
    }

    // ---- Komodo client ------------------------------------------------------

    const komodoUrl = core.getInput('komodo-url') || process.env.KOMODO_URL
    const apiKey = core.getInput('api-key') || process.env.KOMODO_API_KEY
    const apiSecret =
      core.getInput('api-secret') || process.env.KOMODO_API_SECRET

    if (!komodoUrl || !apiKey || !apiSecret) {
      core.setFailed(
        'Komodo URL / API key / API secret must be provided either via input or env'
      )
      return
    }

    const client = KomodoClient(komodoUrl, {
      type: 'api-key',
      params: {
        key: apiKey,
        secret: apiSecret
      }
    })

    // ---- Execution ----------------------------------------------------------

    const results: UpdateItem[] = []

    for (const name of patterns) {
      core.info(`🚀 ${kind} → ${name}`)

      const result = await executeOne(client, kind, name)

      if (Array.isArray(result)) {
        results.push(...result)
      } else {
        results.push(result)
      }
    }

    // ---- Output mapping -----------------------------------------------------

    const updateStatusMap = results
      .filter(hasOid)
      .reduce<Record<string, Update['status']>>((acc, update) => {
        acc[update._id.$oid] = update.status
        return acc
      }, {})

    core.setOutput('updates', updateStatusMap)

    // Write summary to GitHub UI
    await writeStepSummary(updateStatusMap)
  } catch (err) {
    if (err instanceof Error) core.setFailed(err.message)
  }
}
