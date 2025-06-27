import {
    executeLoanCheckerAgentLogic,
    loanCheckerAgentConfigSchema,
    loanCheckerAgentInputSchema,
    LoanCheckerAgentConfig,
    LoanCheckerAgentInput,
    LoanCheckerAgentOutput
} from './loanCheckerAgent';

describe('executeLoanCheckerAgentLogic', () => {
  const baseConfig: LoanCheckerAgentConfig = {
    requiredDocumentTypes: ["ID_PROOF", "INCOME_PROOF"],
    basicWorthinessRules: [
      { fieldName: "statedIncome", operator: ">=", value: 50000, description: "Min Income" },
      { fieldName: "creditScore", operator: ">=", value: 650, description: "Min Credit Score" },
    ],
  };

  const baseInput: LoanCheckerAgentInput = {
    submittedDocuments: [
      { docType: "ID_PROOF", fileName: "id.pdf" },
      { docType: "INCOME_PROOF", fileName: "income.pdf" },
    ],
    applicationData: {
      statedIncome: 60000,
      creditScore: 700,
    },
  };

  it('should approve if all documents present and all rules pass', async () => {
    const result = await executeLoanCheckerAgentLogic(baseConfig, baseInput);
    expect(result.documentsOk).toBe(true);
    expect(result.missingDocumentTypes).toEqual([]);
    expect(result.rulesCheckResult.passedAll).toBe(true);
    expect(result.overallAssessment).toBe('Approved');
    expect(result.assessmentReason).toContain('All documents present and basic worthiness rules passed.');
  });

  it('should reject if a required document is missing', async () => {
    const inputMissingDoc: LoanCheckerAgentInput = {
      ...baseInput,
      submittedDocuments: [{ docType: "ID_PROOF", fileName: "id.pdf" }],
    };
    const result = await executeLoanCheckerAgentLogic(baseConfig, inputMissingDoc);
    expect(result.documentsOk).toBe(false);
    expect(result.missingDocumentTypes).toEqual(["INCOME_PROOF"]);
    expect(result.overallAssessment).toBe('Rejected');
    expect(result.assessmentReason).toContain('Missing required documents: INCOME_PROOF');
  });

  it('should reject if a rule fails (e.g., income too low)', async () => {
    const inputLowIncome: LoanCheckerAgentInput = {
      ...baseInput,
      applicationData: { ...baseInput.applicationData, statedIncome: 40000 },
    };
    const result = await executeLoanCheckerAgentLogic(baseConfig, inputLowIncome);
    expect(result.documentsOk).toBe(true);
    expect(result.rulesCheckResult.passedAll).toBe(false);
    const incomeRuleResult = result.rulesCheckResult.ruleResults.find(r => r.fieldName === 'statedIncome');
    expect(incomeRuleResult?.passed).toBe(false);
    expect(result.overallAssessment).toBe('Rejected');
    expect(result.assessmentReason).toContain('One or more worthiness rules failed');
  });

  it('should reject if a rule field is missing in applicationData', async () => {
    const inputMissingField: LoanCheckerAgentInput = {
      ...baseInput,
      applicationData: { creditScore: 700 }, // statedIncome is missing
    };
    const result = await executeLoanCheckerAgentLogic(baseConfig, inputMissingField);
    expect(result.documentsOk).toBe(true);
    expect(result.rulesCheckResult.passedAll).toBe(false);
    const incomeRuleResult = result.rulesCheckResult.ruleResults.find(r => r.fieldName === 'statedIncome');
    expect(incomeRuleResult?.passed).toBe(false);
    expect(incomeRuleResult?.message).toContain("Field 'statedIncome' not found");
    expect(result.overallAssessment).toBe('Rejected');
  });

  it('should correctly evaluate different operators', async () => {
    const configWithMoreRules: LoanCheckerAgentConfig = {
        requiredDocumentTypes: ["TEST_DOC"],
        basicWorthinessRules: [
            { fieldName: "age", operator: ">=", value: 18 },
            { fieldName: "accountBalance", operator: ">", value: 1000 },
            { fieldName: "loanPurpose", operator: "==", value: "BUSINESS" },
            { fieldName: "riskFlag", operator: "<=", value: 3 },
            { fieldName: "yearsAtAddress", operator: "<", value: 10 },
            { fieldName: "hasPreviousLoan", operator: "exists" },
            { fieldName: "isDefaulter", operator: "not_exists" },
        ]
    };
    const inputForMoreRules: LoanCheckerAgentInput = {
        submittedDocuments: [{ docType: "TEST_DOC" }],
        applicationData: {
            age: 25,
            accountBalance: 1500,
            loanPurpose: "BUSINESS",
            riskFlag: 2,
            yearsAtAddress: 5,
            hasPreviousLoan: true,
            // isDefaulter is not present, so "not_exists" should pass
        }
    };
    const result = await executeLoanCheckerAgentLogic(configWithMoreRules, inputForMoreRules);
    expect(result.rulesCheckResult.passedAll).toBe(true);
    expect(result.overallAssessment).toBe('Approved');
  });

   it('should handle empty rules gracefully', async () => {
    const configNoRules: LoanCheckerAgentConfig = {
      ...baseConfig,
      basicWorthinessRules: [],
    };
    const result = await executeLoanCheckerAgentLogic(configNoRules, baseInput);
    expect(result.documentsOk).toBe(true);
    expect(result.rulesCheckResult.passedAll).toBe(true); // No rules, so all (zero) rules passed
    expect(result.overallAssessment).toBe('Approved');
  });

  it('should handle empty submitted documents gracefully', async () => {
    const inputNoDocs: LoanCheckerAgentInput = {
      ...baseInput,
      submittedDocuments: [],
    };
    const result = await executeLoanCheckerAgentLogic(baseConfig, inputNoDocs);
    expect(result.documentsOk).toBe(false);
    expect(result.missingDocumentTypes).toEqual(["ID_PROOF", "INCOME_PROOF"]);
    expect(result.overallAssessment).toBe('Rejected');
  });

});

// Basic Zod schema validation tests (optional, as Zod handles this, but good for sanity)
describe('LoanCheckerAgent Schemas', () => {
    it('loanCheckerAgentConfigSchema should validate correct config', () => {
        expect(() => loanCheckerAgentConfigSchema.parse({
            requiredDocumentTypes: ["doc1"],
            basicWorthinessRules: [{fieldName: "f1", operator: ">=", value: 10}]
        })).not.toThrow();
    });
     it('loanCheckerAgentConfigSchema should invalidate incorrect config', () => {
        expect(() => loanCheckerAgentConfigSchema.parse({
            requiredDocumentTypes: [], // Fails minItems: 1
        })).toThrow();
    });

    it('loanCheckerAgentInputSchema should validate correct input', () => {
        expect(() => loanCheckerAgentInputSchema.parse({
            submittedDocuments: [{docType: "doc1"}],
            applicationData: {key: "value"}
        })).not.toThrow();
    });
});
