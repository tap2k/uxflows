// Plain TS types mirroring SCHEMA.md. v0 fields are required where the schema
// marks them so; v1 additive fields (steps, capabilities, exit-path actions,
// typed variable declarations) are optional and only populated in v1 specs.
// TypeBox/Ajv validation will layer on later.

export type Method = "llm" | "calculation" | "direct";
export type VariableType = "string" | "number" | "boolean" | "enum";
export type VariableScope = "plan_level" | "per_persona";
export type FlowType = "happy" | "sad" | "off" | "utility" | "interrupt";
export type ExitType = "happy" | "sad" | "off" | "exit" | "return_to_caller";

export interface VariableDecl {
  type: VariableType;
  scope: VariableScope;
  description?: string;
  example?: unknown;
}

export interface Guardrail {
  id: string;
  statement: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  scripts?: Record<string, string>;
}

export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
}

export interface TableField {
  field: string;
  description: string;
  type: string;
}

export interface TableEntry {
  id: string;
  name: string;
  purpose: string;
  structure: TableField[];
  rows: Record<string, unknown>[];
  scaling_rule?: string;
}

export interface Knowledge {
  faq?: FaqEntry[];
  glossary?: GlossaryEntry[];
  tables?: TableEntry[];
}

export type CapabilityKind = "retrieval" | "function";

export interface Capability {
  id: string;
  name: string;
  description: string;
  kind: CapabilityKind;
  inputs?: string[];
  outputs?: string[];
}

export interface AgentMeta {
  name: string;
  purpose: string;
  client?: string;
  languages?: string[];
  user_segments?: string;
}

export interface Agent {
  $schema?: string;
  id: string;
  version: string;
  meta: AgentMeta;
  system_prompt?: string;
  chatbot_initiates?: boolean;
  variables?: Record<string, VariableDecl>;
  guardrails?: Guardrail[];
  capabilities?: Capability[];
  knowledge?: Knowledge;
  entry_flow_id: string;
}

export interface Condition {
  id: string;
  expression: string;
  method: Method;
}

export interface Capture {
  id: string;
  variable: string;
  type?: VariableType;
  method: Method;
  pattern?: string;
  value?: unknown;
}

export interface UtteranceVariation {
  id: string;
  text: string;
}

export interface Utterance {
  id: string;
  language: string;
  dialect?: string;
  variations: UtteranceVariation[];
}

export interface TurnStep {
  id: string;
  type: "turn";
  role: "agent" | "user";
  label?: string;
  content?: string;
  variables_used?: string[];
  condition?: Condition;
  captures?: Capture[];
  utterances?: Utterance[];
}

export type Step = TurnStep;

export interface AssignValue {
  method: Method;
  value: unknown;
}

export interface ExitPathAction {
  id: string;
  capability_id: string;
}

export interface ExitPath {
  id: string;
  type: ExitType;
  condition?: Condition;
  next_flow_id: string | null;
  assigns?: Record<string, AssignValue>;
  actions?: ExitPathAction[];
}

export interface FlowKnowledge {
  faq?: FaqEntry[];
}

export interface Routing {
  entry_conditions?: Condition[];
  exit_paths: ExitPath[];
}

export interface ScriptLine {
  id: string;
  text: string;
}

export interface Flow {
  $schema?: string;
  id: string;
  version: string;
  name: string;
  description?: string;
  type: FlowType;
  scope?: ["global"] | string[];
  instructions?: string;
  scripts?: Record<string, ScriptLine[]>;
  // v1: structured turn sequencing
  steps?: Step[];
  guardrails?: Guardrail[];
  max_turns?: number;
  example?: string;
  knowledge?: FlowKnowledge;
  routing: Routing;
}

export interface Spec {
  agent: Agent;
  flows: Flow[];
}
