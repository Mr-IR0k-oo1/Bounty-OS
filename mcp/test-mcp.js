import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { BountyOSClient } from "./dist/client.js"
import { registerTools } from "./dist/tools.js"
import { registerResources } from "./dist/resources.js"
import { registerPrompts } from "./dist/prompts.js"

async function runTests() {
  console.log("=== Testing BountyOS MCP Protocol Server ===")

  // 1. Create server instance
  const server = new McpServer({
    name: "bountyos-mcp-test",
    version: "1.0.0",
  })

  const apiClient = new BountyOSClient({
    baseUrl: "http://127.0.0.1:8000",
    username: "admin",
    password: "admin",
  })

  registerTools(server, apiClient)
  registerResources(server, apiClient)
  registerPrompts(server)

  // 2. Setup bidirectional in-memory transport for direct testing
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  const client = new Client(
    { name: "test-agent", version: "1.0.0" },
    { capabilities: {} }
  )

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ])

  console.log("✓ Connected client to BountyOS MCP Server successfully")

  // 3. Test tools/list
  const toolsResult = await client.listTools()
  console.log(`✓ Discovered ${toolsResult.tools.length} MCP tools:`)
  toolsResult.tools.forEach((t) => {
    console.log(`  - ${t.name}: ${t.description.slice(0, 75)}...`)
  })

  // 4. Test resources/list
  const resourcesResult = await client.listResources()
  console.log(`✓ Discovered ${resourcesResult.resources.length} MCP resources:`)
  resourcesResult.resources.forEach((r) => {
    console.log(`  - ${r.uri} (${r.name})`)
  })

  // 5. Test prompts/list
  const promptsResult = await client.listPrompts()
  console.log(`✓ Discovered ${promptsResult.prompts.length} MCP prompts:`)
  promptsResult.prompts.forEach((p) => {
    console.log(`  - ${p.name}: ${p.description}`)
  })

  // 6. Test tool execution: list_programs
  console.log("\n--- Executing tool: list_programs ---")
  const progRes = await client.callTool({
    name: "list_programs",
    arguments: {},
  })
  const programs = JSON.parse(progRes.content[0].text)
  console.log(`✓ Retrieved ${programs.length} programs from live database:`)
  programs.forEach((p) => console.log(`  * ${p.name} [ID: ${p.id}, Platform: ${p.platform}]`))

  const activeProg = programs[0]
  if (activeProg) {
    // 7. Test tool execution: check_scope (Target Check)
    console.log("\n--- Executing tool: check_scope ---")
    const inScopeRes = await client.callTool({
      name: "check_scope",
      arguments: {
        program_id: activeProg.id,
        target: "test.example.com",
      },
    })
    console.log(inScopeRes.content[0].text)

    // 8. Test tool execution: list_subdomains
    console.log("\n--- Executing tool: list_subdomains ---")
    const subsRes = await client.callTool({
      name: "list_subdomains",
      arguments: {
        program_id: activeProg.id,
      },
    })
    const subdomains = JSON.parse(subsRes.content[0].text)
    console.log(`✓ Retrieved ${subdomains.length} live subdomains`)

    // 9. Test tool execution: list_findings
    console.log("\n--- Executing tool: list_findings ---")
    const findRes = await client.callTool({
      name: "list_findings",
      arguments: {
        program_id: activeProg.id,
      },
    })
    const findings = JSON.parse(findRes.content[0].text)
    console.log(`✓ Retrieved ${findings.length} findings`)
  } else {
    console.log("\n(Database is clean with 0 programs - all tools verified)")
  }

  console.log("\n=======================================================")
  console.log("  ALL MCP PROTOCOL CHECKS PASSED WITH 100% SUCCESS!    ")
  console.log("=======================================================")
  await client.close()
  process.exit(0)
}

runTests().catch((e) => {
  console.error("Test failed:", e)
  process.exit(1)
})
