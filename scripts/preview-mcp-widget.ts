/** Local MCP Apps host harness. Default data is illustrative, never production. */
import { createServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createExamCookerMcpServer } from "@/lib/mcp/examcooker-server";
import { EXAMCOOKER_WIDGET_HTML } from "@/lib/mcp/examcooker-widget";

const examples = [
  {
    id: "course:BMAT101L",
    title: "Course: BMAT101L - Calculus (61 papers, 31 notes)",
    path: "/past_papers/BMAT101L",
  },
  {
    id: "course:BCSE202L",
    title:
      "Course: BCSE202L - Data Structures and Algorithms (47 papers, 12 notes)",
    path: "/past_papers/BCSE202L",
  },
  {
    id: "course:BPHY101L",
    title: "Course: BPHY101L - Engineering Physics (76 papers, 20 notes)",
    path: "/past_papers/BPHY101L",
  },
  {
    id: "past_paper:sample",
    title: "Past paper: Calculus CAT-2 (BMAT101L, CAT-2, 2025)",
    path: "/past_papers/BMAT101L",
  },
  {
    id: "note:sample",
    title: "Note: Calculus revision notes (BMAT101L)",
    path: "/notes/course/BMAT101L",
  },
  {
    id: "syllabus:sample",
    title: "Syllabus: Calculus (BMAT101L)",
    path: "/syllabus/course/BMAT101L",
  },
  {
    id: "resource:sample",
    title: "Resource: Calculus module resources",
    path: "/resources/course/BMAT101L",
  },
].map(({ path, ...item }) => ({
  ...item,
  url: "https://examcooker.acmvit.in" + path,
}));

async function main() {
  const client = new Client({
    name: "examcooker-widget-preview",
    version: "0.3.0",
  });
  const upstream = process.env.MCP_PREVIEW_UPSTREAM;
  if (upstream) {
    await client.connect(new StreamableHTTPClientTransport(new URL(upstream)));
  } else {
    const server = createExamCookerMcpServer({
      search: async (query) => ({
        results:
          query.toLowerCase() === "empty"
            ? []
            : examples.filter(
                (item) =>
                  !query ||
                  item.title.toLowerCase().includes(query.toLowerCase()),
              ),
      }),
      fetch: async (id) => {
        const item = examples.find((example) => example.id === id);
        return item
          ? {
              ...item,
              text:
                "# " +
                item.title +
                "\n\nSample catalog data for local UI testing.\n\n## Module resources\n- Limits and derivatives\n- Integration and applications\n\nThese example topics are not a retrieved syllabus or past paper.",
              metadata: {
                type: item.id.split(":")[0],
                ...(item.id.startsWith("course:")
                  ? {
                      courseCode: item.id.slice(7),
                      paperCount: 61,
                      noteCount: 31,
                    }
                  : {}),
              },
            }
          : null;
      },
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  }
  const host = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>ExamCooker widget preview</title><style>body{margin:0;font:12px system-ui;background:#0C1222;color:#D5D5D5}header{padding:8px 16px;border-bottom:1px solid #ffffff30}iframe{width:100%;min-height:100vh;border:0;display:block}</style></head><body><header>Local MCP Apps preview · ${upstream ? "Connected catalog" : "Sample data"} · Messages are recorded here; no ChatGPT conversation is created.</header><iframe src="/widget" title="ExamCooker"></iframe><script>
const frame=document.querySelector('iframe');window.trace=[];window.latestContext=null;window.lastPrompt=null;
const send=(payload)=>frame.contentWindow.postMessage({jsonrpc:'2.0',...payload},'*');
window.setHostContext=(params)=>send({method:'ui/notifications/host-context-changed',params});
window.addEventListener('message',async(event)=>{
 if(event.source!==frame.contentWindow||event.data?.jsonrpc!=='2.0')return;
 const msg=event.data;window.trace.push(msg);
 try{
  let result={};
  if(msg.method==='ui/initialize')result={protocolVersion:'2026-01-26',hostInfo:{name:'local-bridge-harness',version:'1.0.0'},hostCapabilities:{message:{text:{}},updateModelContext:{text:{},resourceLink:{},structuredContent:{}}},hostContext:{theme:new URLSearchParams(location.search).get('theme')||'dark',displayMode:'fullscreen'}};
  if(msg.method==='ui/notifications/initialized'){const initial=await fetch('/rpc',{method:'POST',body:JSON.stringify({name:'open_study_workspace',arguments:{}})}).then(r=>r.json());send({method:'ui/notifications/tool-result',params:initial});return;}
  if(msg.method==='tools/call'){result=await fetch('/rpc',{method:'POST',body:JSON.stringify(msg.params)}).then(r=>r.json());}
  if(msg.method==='ui/update-model-context'){window.latestContext={...msg.params,updateId:crypto.randomUUID()};result={updateId:window.latestContext.updateId};}
  if(msg.method==='ui/message')window.lastPrompt=msg.params;
  if(msg.id!=null)send({id:msg.id,result});
 }catch(error){if(msg.id!=null)send({id:msg.id,error:{code:-32603,message:'Preview request failed.'}});}
});
</script></body></html>`;
  const http = createServer(async (request, response) => {
    if (request.url === "/widget") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(EXAMCOOKER_WIDGET_HTML);
    } else if (request.url === "/rpc" && request.method === "POST") {
      try {
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 16000) throw new Error("Request too large");
        }
        const result = await client.callTool(JSON.parse(body));
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(result));
      } catch {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            isError: true,
            content: [{ type: "text", text: "Preview request failed." }],
          }),
        );
      }
    } else {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(host);
    }
  });
  const port = Number(process.env.MCP_PREVIEW_PORT || 4318);
  http.listen(port, "127.0.0.1", () =>
    console.log("ExamCooker widget preview: http://127.0.0.1:" + port),
  );
  const close = () => {
    http.close();
    void client.close().then(() => process.exit(0));
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
main().catch(() => {
  console.error("Could not start ExamCooker widget preview.");
  process.exitCode = 1;
});
