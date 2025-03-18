"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const github_1 = require("./github");
async function run() {
    try {
        // Get inputs
        const token = core.getInput('github-token', { required: true });
        const projectId = core.getInput('project-id', { required: true });
        const columnName = core.getInput('column-name');
        const statusFieldName = core.getInput('status-field-name') || 'Status';
        const customFieldMappings = core.getInput('custom-field-mappings') || '{}';
        // Get issue details
        let issueNumber;
        let repo;
        let owner;
        const issueNumberInput = core.getInput('issue-number');
        const repositoryInput = core.getInput('repository');
        if (issueNumberInput) {
            issueNumber = parseInt(issueNumberInput, 10);
        }
        else if (github.context.payload.issue) {
            issueNumber = github.context.payload.issue.number;
        }
        else {
            throw new Error('No issue number provided and no issue in event context');
        }
        if (repositoryInput) {
            [owner, repo] = repositoryInput.split('/');
        }
        else {
            owner = github.context.repo.owner;
            repo = github.context.repo.repo;
        }
        // Get the issue data
        const octokit = github.getOctokit(token);
        const { data: issue } = await octokit.rest.issues.get({
            owner,
            repo,
            issue_number: issueNumber
        });
        core.info(`Adding issue #${issueNumber} from ${owner}/${repo} to project ${projectId}`);
        // Add issue to project
        const itemId = await (0, github_1.addIssueToProject)(token, projectId, owner, repo, issueNumber);
        core.info(`Issue successfully added to project with item ID: ${itemId}`);
        // Set column if provided
        if (columnName && itemId) {
            await (0, github_1.setProjectColumn)(token, projectId, itemId, statusFieldName, columnName);
            core.info(`Issue placed in column: "${columnName}"`);
        }
        // Process custom field mappings
        const fieldMappings = JSON.parse(customFieldMappings);
        const extractedData = extractDataFromIssue(issue.body || '', issue.title, issue.labels);
        for (const [fieldName, extractionRule] of Object.entries(fieldMappings)) {
            const value = getValueFromExtractionRule(extractionRule, extractedData);
            if (value !== null && value !== undefined) {
                await (0, github_1.setCustomFieldValue)(token, projectId, itemId, fieldName, value);
                core.info(`Set custom field "${fieldName}" to "${value}"`);
            }
        }
        core.setOutput('item-id', itemId);
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed('Unknown error occurred');
        }
    }
}
/**
 * Extracts structured data from an issue
 */
function extractDataFromIssue(body, title, labels) {
    const data = {
        title,
        labels: labels.map(l => l.name)
    };
    // Extract fields from GitHub issue form submissions
    // These typically appear as ### Field name\n\nValue in the issue body
    const fieldMatches = body.matchAll(/### ([^\n]+)\s*\n\s*([^\n#]+)/g);
    for (const match of fieldMatches) {
        const fieldName = match[1].trim();
        const fieldValue = match[2].trim();
        data[fieldName.toLowerCase()] = fieldValue;
    }
    // Also look for YAML-like syntax often used in templates
    const yamlMatches = body.matchAll(/(\w+):\s*["']?([^"'\n]+)["']?/g);
    for (const match of yamlMatches) {
        data[match[1].toLowerCase()] = match[2].trim();
    }
    return data;
}
/**
 * Gets a value from extraction rule and extracted data
 */
function getValueFromExtractionRule(rule, data) {
    if (rule.startsWith('field:')) {
        const fieldName = rule.substring(6).toLowerCase();
        return data[fieldName];
    }
    else if (rule.startsWith('label-contains:')) {
        const searchText = rule.substring(14).toLowerCase();
        return data.labels.some((l) => l.toLowerCase().includes(searchText));
    }
    else if (rule.startsWith('static:')) {
        return rule.substring(7);
    }
    return null;
}
run();
