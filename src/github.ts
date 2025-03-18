import { getOctokit } from '@actions/github';

/**
 * Adds an issue to a GitHub project
 * @param token GitHub token
 * @param projectId Node ID of the project
 * @param owner Repository owner
 * @param repo Repository name
 * @param issueNumber Issue number to add
 * @returns The ID of the created project item
 */
export async function addIssueToProject(
  token: string,
  projectId: string,
  owner: string, 
  repo: string,
  issueNumber: number
): Promise<string> {
  const octokit = getOctokit(token);
  
  // Get the issue node ID
  const { data: issue } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const issueNodeId = issue.node_id;
  
  // Add issue to project using GraphQL API
  const addProjectItemMutation = `
    mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item {
          id
        }
      }
    }
  `;
  
  const result = await octokit.graphql(addProjectItemMutation, {
    projectId,
    contentId: issueNodeId,
  });
  
  // @ts-ignore - GraphQL response type
  return result.addProjectV2ItemById.item.id;
}

/**
 * Sets the column/status field value for an issue in a project
 * @param token GitHub token
 * @param projectId Node ID of the project
 * @param itemId Project item ID
 * @param statusFieldName Name of the status field (typically "Status")
 * @param columnName Column name to place the issue in
 */
export async function setProjectColumn(
  token: string,
  projectId: string,
  itemId: string,
  statusFieldName: string,
  columnName: string
): Promise<void> {
  const octokit = getOctokit(token);
  
  // First, get the project fields to find the status field ID
  const getProjectFieldsQuery = `
    query GetProjectFields($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const fieldsData = await octokit.graphql(getProjectFieldsQuery, {
    projectId,
  });

  // @ts-ignore - GraphQL response type
  const statusField = fieldsData.node.fields.nodes.find(
    // @ts-ignore - GraphQL response type
    (field: any) => field.name === statusFieldName && field.options
  );
  
  if (!statusField) {
    throw new Error(`No field named "${statusFieldName}" found in project. Available fields are: ` + 
      // @ts-ignore - GraphQL response type
      fieldsData.node.fields.nodes.map((field: any) => field.name).join(', '));
  }
  
  // Find the status option that matches the desired column name
  // @ts-ignore - GraphQL response type
  const statusOption = statusField.options.find(
    (option: any) => option.name.toLowerCase() === columnName.toLowerCase()
  );

  if (!statusOption) {
    throw new Error(`Column "${columnName}" not found in project. Available columns are: ` + 
      // @ts-ignore - GraphQL response type
      statusField.options.map((option: any) => option.name).join(', '));
  }

  // Update the status field to place the issue in the desired column
  const updateProjectItemFieldMutation = `
    mutation UpdateProjectItemField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: {
            singleSelectOptionId: $optionId
          }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }
  `;
  
  await octokit.graphql(updateProjectItemFieldMutation, {
    projectId,
    itemId,
    fieldId: statusField.id,
    optionId: statusOption.id,
  });
}

/**
 * Sets a custom field value for an item in a project
 * @param token GitHub token
 * @param projectId Node ID of the project
 * @param itemId Project item ID
 * @param fieldName Name of the custom field
 * @param value Value to set
 */
export async function setCustomFieldValue(
  token: string,
  projectId: string,
  itemId: string,
  fieldName: string,
  value: any
): Promise<void> {
  const octokit = getOctokit(token);
  
  // First, get the project fields to find the field ID
  const getProjectFieldsQuery = `
    query GetProjectFields($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 20) {
            nodes {
              ... on ProjectV2Field {
                id
                name
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
              ... on ProjectV2IterationField {
                id
                name
                configuration {
                  iterations {
                    id
                    title
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const fieldsData = await octokit.graphql(getProjectFieldsQuery, {
    projectId,
  });

  // @ts-ignore - GraphQL response type
  const field = fieldsData.node.fields.nodes.find(
    (f: any) => f.name.toLowerCase() === fieldName.toLowerCase()
  );
  
  if (!field) {
    throw new Error(`No field named "${fieldName}" found in project. Available fields are: ` + 
      // @ts-ignore - GraphQL response type
      fieldsData.node.fields.nodes.map((f: any) => f.name).join(', '));
  }

  // Determine field type and set appropriate value
  let updateMutation;
  let variables: any = {
    projectId,
    itemId,
    fieldId: field.id
  };

  // Handle different field types
  if (field.options) { 
    // Single select field
    const option = field.options.find(
      (opt: any) => opt.name.toLowerCase() === String(value).toLowerCase()
    );
    
    if (!option) {
      throw new Error(`Value "${value}" not found in options for field "${fieldName}"`);
    }
    
    updateMutation = `
      mutation UpdateProjectSingleSelectField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: {
              singleSelectOptionId: $optionId
            }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;
    variables.optionId = option.id;
    
  } else if (field.configuration?.iterations) {
    // Iteration field
    const iteration = field.configuration.iterations.find(
      (it: any) => it.title.toLowerCase() === String(value).toLowerCase()
    );
    
    if (!iteration) {
      throw new Error(`Iteration "${value}" not found in field "${fieldName}"`);
    }
    
    updateMutation = `
      mutation UpdateProjectIterationField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $iterationId: String!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: {
              iterationId: $iterationId
            }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;
    variables.iterationId = iteration.id;
    
  } else {
    // Text, number, date or other field types
    let fieldValue: any;
    
    // Check if value is a date
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      fieldValue = { date: value };
    } else if (typeof value === 'number') {
      fieldValue = { number: value };
    } else if (typeof value === 'boolean') {
      fieldValue = { boolean: value };
    } else {
      fieldValue = { text: String(value) };
    }
    
    updateMutation = `
      mutation UpdateProjectField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: $value
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;
    variables.value = fieldValue;
  }
  
  // Execute the update
  await octokit.graphql(updateMutation, variables);
}