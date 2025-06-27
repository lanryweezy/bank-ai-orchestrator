import { z } from 'zod';

// --- Configuration Schema for Data Extraction Agent ---
export const fieldExtractionConfigSchema = z.object({
  outputFieldName: z.string().min(1, "Output field name is required."),
  description: z.string().optional(),
  // Method of extraction
  extractionMethod: z.enum(["regex", "ai_entity"]),
  // For regex
  regexPattern: z.string().optional(), // Required if method is 'regex'
  regexFlags: z.string().optional().default("gmi"), // Default flags for regex
  // For AI entity extraction
  aiEntityType: z.string().optional(), // Required if method is 'ai_entity' (e.g., "InvoiceNumber", "EmailAddress", "Date")
  // Optional: specify if multiple values can be extracted for this field
  extractMultiple: z.boolean().optional().default(false),
});
export type FieldExtractionConfig = z.infer<typeof fieldExtractionConfigSchema>;

export const dataExtractorAgentConfigSchema = z.object({
  sourceDataFieldPath: z.string().min(1, "Source data field path is required (e.g., 'email.body', 'document.textContent')."),
  fieldsToExtract: z.array(fieldExtractionConfigSchema).min(1, "At least one field to extract is required."),
});
export type DataExtractorAgentConfig = z.infer<typeof dataExtractorAgentConfigSchema>;


// --- Input Schema for Data Extraction Agent ---
export const dataExtractorAgentInputSchema = z.object({
  // The input will be a generic JSON object, and the agent's config
  // will specify where to find the text to process via `sourceDataFieldPath`.
  // Example: { "email": { "body": "...", "subject": "..." }, "document": { "id": "...", "textContent": "..." } }
  data: z.record(z.any()),
});
export type DataExtractorAgentInput = z.infer<typeof dataExtractorAgentInputSchema>;


// --- Output Schema for Data Extraction Agent ---
export interface DataExtractorAgentOutput {
  extractedFields: Record<string, any | any[]>; // FieldName: extractedValue(s)
  errors: Array<{ fieldName: string; message: string }>;
}

// Helper to get a value from a nested object using a dot-notation path
const getNestedValue = (obj: Record<string, any>, path: string): any => {
  if (!path) return undefined;
  return path.split('.').reduce((currentObject, key) => {
    return currentObject && typeof currentObject === 'object' && currentObject[key] !== undefined ? currentObject[key] : undefined;
  }, obj);
};


// --- Core Logic for Data Extraction Agent ---
export const executeDataExtractorAgentLogic = async (
  config: DataExtractorAgentConfig,
  input: DataExtractorAgentInput
): Promise<DataExtractorAgentOutput> => {
  const extractedFields: Record<string, any | any[]> = {};
  const errors: Array<{ fieldName: string; message: string }> = [];

  const sourceText = getNestedValue(input.data, config.sourceDataFieldPath);

  if (typeof sourceText !== 'string') {
    errors.push({ fieldName: config.sourceDataFieldPath, message: `Source text not found or not a string at path: ${config.sourceDataFieldPath}` });
    // Return early if no source text to process
    return { extractedFields, errors };
  }

  for (const fieldConfig of config.fieldsToExtract) {
    try {
      let extractedValue: any | any[] | undefined;

      if (fieldConfig.extractionMethod === "regex") {
        if (!fieldConfig.regexPattern) {
          errors.push({ fieldName: fieldConfig.outputFieldName, message: "Regex pattern is missing for regex extraction method." });
          continue;
        }
        const regex = new RegExp(fieldConfig.regexPattern, fieldConfig.regexFlags || "gmi");
        const matches = Array.from(sourceText.matchAll(regex));

        if (matches.length > 0) {
            if (fieldConfig.extractMultiple) {
                extractedValue = matches.map(match => match[1] || match[0]); // Prefer first capture group if available
            } else {
                extractedValue = matches[0][1] || matches[0][0]; // Prefer first capture group
            }
        }

      } else if (fieldConfig.extractionMethod === "ai_entity") {
        if (!fieldConfig.aiEntityType) {
          errors.push({ fieldName: fieldConfig.outputFieldName, message: "AI entity type is missing for AI extraction method." });
          continue;
        }
        // ** Simulate AI call **
        console.log(`Simulating AI call to extract entity type: '${fieldConfig.aiEntityType}' for field '${fieldConfig.outputFieldName}'...`);
        // Mocked responses based on entity type
        switch (fieldConfig.aiEntityType.toLowerCase()) {
          case 'invoicenumber':
            extractedValue = fieldConfig.extractMultiple ? ["INV-MOCK-001", "INV-MOCK-002"] : "INV-MOCK-001";
            break;
          case 'emailaddress':
            extractedValue = fieldConfig.extractMultiple ? ["test@example.com", "another@example.com"] : "test@example.com";
            break;
          case 'date':
            extractedValue = fieldConfig.extractMultiple ? ["2024-01-15", "2024-03-22"] : new Date().toISOString().split('T')[0];
            break;
          case 'totalamount':
             extractedValue = fieldConfig.extractMultiple ? [150.75, 200.00] : 150.75;
             break;
          default:
            extractedValue = fieldConfig.extractMultiple ? [`mock_${fieldConfig.aiEntityType}_1`, `mock_${fieldConfig.aiEntityType}_2`] : `mock_${fieldConfig.aiEntityType}`;
        }
        console.log(`Mocked AI response for '${fieldConfig.aiEntityType}':`, extractedValue);
      }

      if (extractedValue !== undefined) {
         extractedFields[fieldConfig.outputFieldName] = extractedValue;
      } else if (fieldConfig.extractMultiple) {
         extractedFields[fieldConfig.outputFieldName] = []; // Ensure array type if multiple expected but none found
      }

    } catch (e: any) {
      errors.push({ fieldName: fieldConfig.outputFieldName, message: `Error during extraction: ${e.message}` });
    }
  }

  return { extractedFields, errors };
};

export const DATA_EXTRACTOR_AGENT_LOGIC_ID = 'dataExtractorAgent_v1';

// JSON Schema for the configurable_params_json_schema field
export const dataExtractorAgentJsonSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Data Extraction Agent Configuration",
  "description": "Configures the Data Extraction Agent to pull specific fields from text.",
  "type": "object",
  "properties": {
    "sourceDataFieldPath": {
      "type": "string",
      "description": "Dot-notation path to the text field in the input data (e.g., 'email.body', 'document.textContent').",
      "examples": ["emailBody", "documentText"]
    },
    "fieldsToExtract": {
      "type": "array",
      "description": "Configuration for each field to be extracted.",
      "items": {
        "type": "object",
        "properties": {
          "outputFieldName": {
            "type": "string",
            "description": "The name of the field in the output where extracted data will be stored."
          },
          "description": {
            "type": "string",
            "description": "Optional description of what this field represents."
          },
          "extractionMethod": {
            "type": "string",
            "enum": ["regex", "ai_entity"],
            "description": "Method to use for extraction."
          },
          "regexPattern": {
            "type": "string",
            "description": "JavaScript regex pattern (if method is 'regex'). Use capture groups for specific parts."
          },
          "regexFlags": {
            "type": "string",
            "description": "Regex flags (e.g., 'gmi'). Defaults to 'gmi'.",
            "default": "gmi"
          },
          "aiEntityType": {
            "type": "string",
            "description": "Type of AI entity to extract (if method is 'ai_entity'). E.g., 'InvoiceNumber', 'EmailAddress', 'Date', 'TotalAmount'."
          },
          "extractMultiple": {
            "type": "boolean",
            "description": "Set to true if multiple occurrences of this field can be extracted into an array.",
            "default": false
          }
        },
        "required": ["outputFieldName", "extractionMethod"]
      },
      "minItems": 1
    }
  },
  "required": ["sourceDataFieldPath", "fieldsToExtract"]
};
