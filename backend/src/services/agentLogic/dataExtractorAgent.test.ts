import {
  executeDataExtractorAgentLogic,
  dataExtractorAgentConfigSchema,
  dataExtractorAgentInputSchema,
  DataExtractorAgentConfig,
  DataExtractorAgentInput
} from './dataExtractorAgent';

describe('executeDataExtractorAgentLogic', () => {
  it('should extract data using regex', async () => {
    const config: DataExtractorAgentConfig = {
      sourceDataFieldPath: 'emailBody',
      fieldsToExtract: [
        {
          outputFieldName: 'invoiceNumber',
          extractionMethod: 'regex',
          regexPattern: 'Invoice Number: (INV-\\d+)',
        },
        {
          outputFieldName: 'amount',
          extractionMethod: 'regex',
          regexPattern: 'Amount: \\$(\\d+\\.\\d{2})',
        },
      ],
    };
    const input: DataExtractorAgentInput = {
      data: { emailBody: "Hello, Invoice Number: INV-123. Amount: $50.75. Thanks." }
    };
    const result = await executeDataExtractorAgentLogic(config, input);
    expect(result.errors.length).toBe(0);
    expect(result.extractedFields.invoiceNumber).toBe('INV-123');
    expect(result.extractedFields.amount).toBe('50.75');
  });

  it('should extract multiple values with regex if configured', async () => {
    const config: DataExtractorAgentConfig = {
      sourceDataFieldPath: 'logData',
      fieldsToExtract: [
        {
          outputFieldName: 'errorCodes',
          extractionMethod: 'regex',
          regexPattern: 'Error: (E\\d+)',
          extractMultiple: true,
        },
      ],
    };
    const input: DataExtractorAgentInput = {
      data: { logData: "Error: E404. Status: OK. Error: E500." }
    };
    const result = await executeDataExtractorAgentLogic(config, input);
    expect(result.errors.length).toBe(0);
    expect(result.extractedFields.errorCodes).toEqual(['E404', 'E500']);
  });

  it('should extract data using mocked AI entity extraction', async () => {
    const config: DataExtractorAgentConfig = {
      sourceDataFieldPath: 'customerQuery',
      fieldsToExtract: [
        {
          outputFieldName: 'extractedEmail',
          extractionMethod: 'ai_entity',
          aiEntityType: 'EmailAddress',
        },
        {
          outputFieldName: 'extractedDate',
          extractionMethod: 'ai_entity',
          aiEntityType: 'Date',
          extractMultiple: false, // Explicitly false
        },
      ],
    };
    const input: DataExtractorAgentInput = {
      data: { customerQuery: "My email is test@example.com and I need help by tomorrow." }
    };
    const result = await executeDataExtractorAgentLogic(config, input);
    expect(result.errors.length).toBe(0);
    expect(result.extractedFields.extractedEmail).toBe('test@example.com'); // From mock
    expect(result.extractedFields.extractedDate).toBe(new Date().toISOString().split('T')[0]); // From mock
  });

  it('should return errors if sourceDataFieldPath is invalid', async () => {
    const config: DataExtractorAgentConfig = {
      sourceDataFieldPath: 'nonexistent.path',
      fieldsToExtract: [{ outputFieldName: 'test', extractionMethod: 'regex', regexPattern: '.*' }],
    };
    const input: DataExtractorAgentInput = { data: { someOtherKey: 'value' } };
    const result = await executeDataExtractorAgentLogic(config, input);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain('Source text not found');
    expect(Object.keys(result.extractedFields).length).toBe(0);
  });

  it('should return error for regex method if regexPattern is missing', async () => {
    const config: DataExtractorAgentConfig = {
      sourceDataFieldPath: 'text',
      fieldsToExtract: [{ outputFieldName: 'test', extractionMethod: 'regex' /* regexPattern missing */ }],
    };
    const input: DataExtractorAgentInput = { data: { text: 'some data' } };
    const result = await executeDataExtractorAgentLogic(config, input);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].fieldName).toBe('test');
    expect(result.errors[0].message).toContain('Regex pattern is missing');
  });

  it('should return error for ai_entity method if aiEntityType is missing', async () => {
    const config: DataExtractorAgentConfig = {
      sourceDataFieldPath: 'text',
      fieldsToExtract: [{ outputFieldName: 'test', extractionMethod: 'ai_entity' /* aiEntityType missing */ }],
    };
    const input: DataExtractorAgentInput = { data: { text: 'some data' } };
    const result = await executeDataExtractorAgentLogic(config, input);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].fieldName).toBe('test');
    expect(result.errors[0].message).toContain('AI entity type is missing');
  });

  it('should handle nested sourceDataFieldPath', async () => {
    const config: DataExtractorAgentConfig = {
      sourceDataFieldPath: 'payload.data.textBlock',
      fieldsToExtract: [{ outputFieldName: 'greeting', extractionMethod: 'regex', regexPattern: '(Hello)' }],
    };
    const input: DataExtractorAgentInput = { data: { payload: { data: { textBlock: "Hello World" } } } };
    const result = await executeDataExtractorAgentLogic(config, input);
    expect(result.errors.length).toBe(0);
    expect(result.extractedFields.greeting).toBe('Hello');
  });
});

describe('DataExtractorAgent Schemas', () => {
    it('dataExtractorAgentConfigSchema should validate correct config', () => {
        const validConfig = {
            sourceDataFieldPath: "email.body",
            fieldsToExtract: [
                { outputFieldName: "invoiceNo", extractionMethod: "regex", regexPattern: "INV-\\d+" },
                { outputFieldName: "customerEmail", extractionMethod: "ai_entity", aiEntityType: "EmailAddress" }
            ]
        };
        expect(() => dataExtractorAgentConfigSchema.parse(validConfig)).not.toThrow();
    });

    it('dataExtractorAgentConfigSchema should invalidate incorrect config', () => {
        const invalidConfig1 = { // Missing sourceDataFieldPath
             fieldsToExtract: [{ outputFieldName: "test", extractionMethod: "regex", regexPattern: ".*" }]
        };
        const invalidConfig2 = {
            sourceDataFieldPath: "text",
            fieldsToExtract: [] // Fails minItems for fieldsToExtract
        };
        const invalidConfig3 = {
            sourceDataFieldPath: "text",
            fieldsToExtract: [{ outputFieldName: "test" /* missing extractionMethod */ }]
        };
        expect(() => dataExtractorAgentConfigSchema.parse(invalidConfig1)).toThrow();
        expect(() => dataExtractorAgentConfigSchema.parse(invalidConfig2)).toThrow();
        expect(() => dataExtractorAgentConfigSchema.parse(invalidConfig3)).toThrow();
    });
});
