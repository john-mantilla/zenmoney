/**
 * ZenMoney — AI Provider Abstraction Layer
 *
 * Defines the contract for AI providers used for NLQ parsing and financial queries.
 * This abstraction allows swapping between providers (Gemini, OpenAI, Ollama)
 * without changing business logic.
 *
 * MVP: GeminiFlashProvider
 * Future: OllamaProvider (self-hosted), OpenAIProvider
 */
import type { Account, Category, Transaction, BudgetProgress } from '@domain/entities';

// ─── NLQ Transaction Parsing ───────────────────────────────────────────

/** Result of parsing a natural language input into a structured transaction */
export interface NLQParseResult {
  /** Parsed monetary amount, null if couldn't be extracted */
  amount: number | null;
  /** Inferred transaction type */
  type: 'income' | 'expense' | 'transfer' | null;
  /** Suggested category name (fuzzy match against user's categories) */
  suggestedCategoryName: string | null;
  /** Suggested account name (fuzzy match against user's accounts) */
  suggestedAccountName: string | null;
  /** Extracted merchant or vendor name */
  merchantName: string | null;
  /** Generated description for the transaction */
  description: string | null;
  /** Parsed date (ISO format), null defaults to today */
  transactionDate: string | null;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** List of field names that couldn't be parsed and need user input */
  needsUserInput: string[];
  /** Original raw input text */
  rawInput: string;
}

// ─── NLQ Financial Queries ─────────────────────────────────────────────

export interface PendingActionPayload {
  amount: number;
  transactionType?: 'expense' | 'income' | 'transfer';
  suggestedCategoryName?: string;
  suggestedAccountName?: string;
  description?: string;
  merchantName?: string;
  transactionDate?: string;
}

export interface ChallengePendingActionPayload {
  title: string;
  description: string;
  icon?: string;
  categoryTargetName?: string;
  maxAllowedAmount?: number;
  durationDays?: number;
  rewardBadgeTitle: string;
}

/** Result of querying financial data using natural language */
export interface NLQQueryResult {
  /** Human-readable answer to the question */
  answer: string;
  /** Structured data supporting the answer (for charts/displays) */
  data?: Record<string, unknown>;
  /** Suggested follow-up actions */
  suggestedActions?: string[];
  /** Acciones pendientes requeridas por confirmación del usuario (Human-in-the-Loop) */
  pendingAction?: {
    type: 'create_transaction' | 'create_challenge';
    payload: PendingActionPayload | ChallengePendingActionPayload | any;
  };
}

/** Un turno previo de la conversación, para darle memoria al modelo entre preguntas. */
export interface ConversationTurn {
  role: 'user' | 'model';
  text: string;
}

/** Financial context provided to the AI for answering queries */
export interface FinancialContext {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  budgets: BudgetProgress[];
  recentTransactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  currentDate: string;
  currency: string;
}

// ─── AI Provider Interface ─────────────────────────────────────────────

/**
 * Contract for all AI providers in ZenMoney.
 *
 * Implementations:
 * - GeminiFlashProvider: Google Gemini Flash API (MVP)
 * - OllamaProvider: Self-hosted models via Ollama (future)
 * - OpenAIProvider: OpenAI GPT models (future)
 */
export interface AIProvider {
  /** Provider name for logging and analytics */
  readonly name: string;

  /**
   * Parse a natural language input into a structured transaction.
   *
   * @param input - Raw text from voice or typed input (e.g., "pagué 45 mil en el mercado con la tarjeta")
   * @param accounts - User's available accounts for fuzzy matching
   * @param categories - Available categories for fuzzy matching
   * @returns Parsed transaction data with confidence scores
   */
  parseTransaction(
    input: string,
    accounts: Account[],
    categories: Category[],
  ): Promise<NLQParseResult>;

  /**
   * Parse a photo of a receipt/invoice into a structured transaction using vision.
   *
   * @param imageBase64 - Base64-encoded image bytes (no data URI prefix)
   * @param mimeType - Image MIME type (e.g. "image/jpeg")
   * @param accounts - User's available accounts for fuzzy matching
   * @param categories - Available categories for fuzzy matching
   * @returns Parsed transaction data with confidence scores
   */
  parseReceiptImage(
    imageBase64: string,
    mimeType: string,
    accounts: Account[],
    categories: Category[],
  ): Promise<NLQParseResult>;

  /**
   * Answer a natural language question about the user's finances.
   *
   * @param question - Natural language question (e.g., "¿Cuánto gasté en restaurantes este mes?")
   * @param context - Current financial context for accurate answers
   * @param history - Recent prior turns of this conversation, oldest first, so the
   *   model can resolve follow-ups like "¿y el de restaurantes?" in context.
   * @returns Human-readable answer with optional structured data
   */
  queryFinances(
    question: string,
    context: FinancialContext,
    history?: ConversationTurn[],
  ): Promise<NLQQueryResult>;
}
