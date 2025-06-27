import { z } from 'zod';

// Define the structure of the configuration for this agent template
export const loanCheckerAgentConfigSchema = z.object({
  requiredDocumentTypes: z.array(z.string().min(1)).min(1, "At least one required document type is needed."),
  basicWorthinessRules: z.array(
    z.object({
      fieldName: z.string().min(1), // e.g., "statedIncome", "creditScoreFromReport"
      operator: z.enum(['>=', '<=', '==', '>', '<', 'exists', 'not_exists']),
      value: z.any(), // Can be number, string, boolean depending on the rule
      description: z.string().optional(),
    })
  ).optional().default([]),
  // Future: bankEmailForNotifications: z.string().email().optional(),
  // Future: internalDataCheckAPIEndpoint: z.string().url().optional(),
});
export type LoanCheckerAgentConfig = z.infer<typeof loanCheckerAgentConfigSchema>;

// Define the structure of the input data this agent expects
export const loanCheckerAgentInputSchema = z.object({
  submittedDocuments: z.array(
    z.object({
      docType: z.string().min(1), // Should match one of the requiredDocumentTypes
      fileName: z.string().optional(),
      fileId: z.string().uuid().optional(), // Reference to actual document if stored
      // For actual content processing (future):
      // contentBase64: z.string().optional(),
      // textContent: z.string().optional(),
    })
  ).optional().default([]),
  applicationData: z.record(z.any()).optional().default({}), // e.g., { "statedIncome": 60000, "creditScoreFromReport": 700 }
});
export type LoanCheckerAgentInput = z.infer<typeof loanCheckerAgentInputSchema>;

// Define the structure of the output data this agent produces
export interface LoanCheckerAgentOutput {
  documentsOk: boolean;
  missingDocumentTypes: string[];
  verifiedDocumentTypes: string[];
  rulesCheckResult: {
    passedAll: boolean;
    ruleResults: Array<{
      ruleDescription?: string;
      fieldName: string;
      operator: string;
      expectedValue: any;
      actualValue?: any;
      passed: boolean;
      message: string;
    }>;
  };
  overallAssessment: 'Approved' | 'Rejected' | 'RequiresManualReview'; // Simplified assessment
  assessmentReason?: string;
}

// The core logic function for the "Loan Document & Basic Worthiness Checker"
export const executeLoanCheckerAgentLogic = async (
  config: LoanCheckerAgentConfig,
  input: LoanCheckerAgentInput
): Promise<LoanCheckerAgentOutput> => {

  // 1. Document Checklist
  const submittedDocTypes = new Set(input.submittedDocuments.map(doc => doc.docType));
  const missingDocumentTypes: string[] = [];
  const verifiedDocumentTypes: string[] = [];

  config.requiredDocumentTypes.forEach(reqDocType => {
    if (submittedDocTypes.has(reqDocType)) {
      verifiedDocumentTypes.push(reqDocType);
    } else {
      missingDocumentTypes.push(reqDocType);
    }
  });
  const documentsOk = missingDocumentTypes.length === 0;

  // 2. Basic Worthiness Rules Evaluation
  const ruleResults: LoanCheckerAgentOutput['rulesCheckResult']['ruleResults'] = [];
  let passedAllRules = true;

  for (const rule of config.basicWorthinessRules) {
    const actualValue = input.applicationData[rule.fieldName];
    let rulePassed = false;
    let message = '';

    if (actualValue === undefined && rule.operator !== 'not_exists' && rule.operator !== 'exists') {
      rulePassed = false;
      message = `Field '${rule.fieldName}' not found in application data.`;
    } else {
        switch (rule.operator) {
            case '>=': rulePassed = actualValue >= rule.value; break;
            case '<=': rulePassed = actualValue <= rule.value; break;
            case '==': rulePassed = actualValue == rule.value; break; // Use loose equality for flexibility if types differ slightly
            case '>':  rulePassed = actualValue > rule.value; break;
            case '<':  rulePassed = actualValue < rule.value; break;
            case 'exists': rulePassed = actualValue !== undefined && actualValue !== null; break;
            case 'not_exists': rulePassed = actualValue === undefined || actualValue === null; break;
            default: rulePassed = false; message = `Unknown operator: ${rule.operator}`;
        }
        if (!message) {
            message = rulePassed ? 'Rule passed.' : `Rule failed: Expected ${rule.fieldName} ${rule.operator} ${rule.value}, got ${actualValue}.`;
        }
    }

    ruleResults.push({
      ruleDescription: rule.description,
      fieldName: rule.fieldName,
      operator: rule.operator,
      expectedValue: rule.value,
      actualValue: actualValue,
      passed: rulePassed,
      message: message,
    });
    if (!rulePassed) {
      passedAllRules = false;
    }
  }

  // 3. Overall Assessment (Simplified)
  let overallAssessment: LoanCheckerAgentOutput['overallAssessment'] = 'RequiresManualReview';
  let assessmentReason = '';

  if (!documentsOk) {
    overallAssessment = 'Rejected';
    assessmentReason = `Missing required documents: ${missingDocumentTypes.join(', ')}.`;
  } else if (!passedAllRules) {
    overallAssessment = 'Rejected'; // Or 'RequiresManualReview' depending on severity/policy
    assessmentReason = `One or more worthiness rules failed. First failure: ${ruleResults.find(r => !r.passed)?.message || 'Unknown rule failure'}`;
  } else {
    overallAssessment = 'Approved'; // Simplified: if all docs OK and all rules pass
    assessmentReason = 'All documents present and basic worthiness rules passed.';
  }

  return {
    documentsOk,
    missingDocumentTypes,
    verifiedDocumentTypes,
    rulesCheckResult: {
      passedAll: passedAllRules,
      ruleResults,
    },
    overallAssessment,
    assessmentReason,
  };
};

// This is the identifier that will be stored in agent_templates.core_logic_identifier
export const LOAN_CHECKER_AGENT_LOGIC_ID = 'loanCheckerAgent_v1';

// JSON Schema for the configurable_params_json_schema field in agent_templates table
export const loanCheckerAgentJsonSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Loan Document & Basic Worthiness Checker Configuration",
  "description": "Configuration parameters for the Loan Document & Basic Worthiness Checker Agent.",
  "type": "object",
  "properties": {
    "requiredDocumentTypes": {
      "type": "array",
      "description": "List of document types required for the loan application.",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "basicWorthinessRules": {
      "type": "array",
      "description": "List of basic rules to evaluate against application data.",
      "items": {
        "type": "object",
        "properties": {
          "fieldName": {
            "type": "string",
            "description": "The field name in the application data to check (e.g., 'statedIncome', 'creditScoreFromReport')."
          },
          "operator": {
            "type": "string",
            "enum": [">=", "<=", "==", ">", "<", "exists", "not_exists"],
            "description": "The comparison operator."
          },
          "value": {
            "description": "The value to compare against (can be number, string, boolean)."
          },
          "description": {
            "type": "string",
            "description": "A human-readable description of the rule."
          }
        },
        "required": ["fieldName", "operator", "value"]
      }
    }
  },
  "required": ["requiredDocumentTypes"]
};
