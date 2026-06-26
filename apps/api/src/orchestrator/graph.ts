import { StateGraph, MemorySaver, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { OrchestratorState } from "./state";
import { createNodes, type NodeDeps } from "./nodes";

/**
 * 构建 LangGraph 状态机 (需求书 3.2 DAG Flow)。
 *
 *   START → extractor →(router)→ ask_user → END        (缺槽位: 单一反问后本轮结束)
 *                              ↘ compute → synthesis → END   (槽位齐备: 出卡片)
 *
 * Phase 1 用 MemorySaver; Phase 2 替换为 PostgresSaver 实现跨设备断线恢复。
 */
export function buildGraph(
  deps: NodeDeps,
  checkpointer: BaseCheckpointSaver = new MemorySaver(),
) {
  const n = createNodes(deps);

  return new StateGraph(OrchestratorState)
    .addNode("extractor", n.extractor)
    .addNode("ask_user", n.askUser)
    .addNode("compute", n.compute)
    .addNode("synthesis", n.synthesis)
    .addEdge(START, "extractor")
    .addConditionalEdges("extractor", n.router, {
      ask_user: "ask_user",
      compute: "compute",
    })
    .addEdge("compute", "synthesis")
    .addEdge("synthesis", END)
    .addEdge("ask_user", END)
    .compile({ checkpointer });
}

export type CommissionGraph = ReturnType<typeof buildGraph>;
