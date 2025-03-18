# Issue to Project Action

A GitHub Action that automatically adds issues to GitHub Projects and populates custom fields with data from issue templates.

## Features

- Add issues to GitHub Projects
- Place issues in specific columns/status values
- Populate custom project fields with data from issue templates
- Support for various field types (text, date, single select, iteration, etc.)
- Works with any issue from any repository you have access to

## Usage

### Basic Usage

```yaml
name: Add Issues to Project

on:
  issues:
    types:
      - opened

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - uses: Showoffninja/issue-to-project@v1
        with:
          github-token: ${{ secrets.PROJECT_TOKEN }}
          project-id: "PN_kwDOABCD1M4A..." # Your project node ID
          column-name: "To Do" # Optional status or column
```

### Advanced Usage with Custom Fields

```yaml
name: Add Issue to Project with Custom Fields

on:
  issues:
    types:
      - opened

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - uses: Showoffninja/issue-to-project@v1
        with:
          github-token: ${{ secrets.PROJECT_TOKEN }}
          project-id: ${{ secrets.PROJECT_ID }}
          column-name: "To Do"
          custom-field-mappings: |
            {
              "Priority": "field:priority",
              "Size": "field:estimated size",
              "Due Date": "field:due date",
              "Team": "field:team",
              "Is Bug": "label-contains:bug",
              "Quarter": "static:Q1 2025"
            }
```

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `github-token` | GitHub token with project permissions | Yes | |
| `project-id` | The Node ID of the GitHub project | Yes | |
| `column-name` | Status/column value to set for the issue | No | |
| `status-field-name` | Name of the status field in the project | No | `Status` |
| `custom-field-mappings` | JSON object mapping project field names to extraction rules | No | `{}` |
| `issue-number` | Specific issue number to add | No | Current issue from context |
| `repository` | Repository in format "owner/repo" | No | Current repository |

## Finding your Project ID

To find your project node ID:
1. Navigate to your GitHub Project
2. The URL will look like `https://github.com/users/username/projects/1`
3. Run this GraphQL query in GitHub's [GraphQL Explorer](https://docs.github.com/en/graphql/overview/explorer):

```graphql
query {
  user(login: "username") {
    projectV2(number: 1) {
      id
    }
  }
}
```

Replace `user` with `organization` if it's an organization project.

## Custom Field Mappings

Map project fields to issue data with these extraction rules:

| Rule Prefix | Description | Example |
|-------------|-------------|---------|
| `field:` | Extract from a field in the issue template | `"field:priority"` |
| `label-contains:` | Check if any issue label contains text | `"label-contains:bug"` |
| `static:` | Set a static value | `"static:Q1 2025"` |

## Creating Issue Templates That Work with This Action

Here's an example issue template that works well with this action:

```yaml
name: Feature Request
description: Suggest an idea for this project
title: "[FEATURE] "
labels: ["enhancement"]
assignees: []

body:
  - type: markdown
    attributes:
      value: |
        Thanks for suggesting a new feature!
        
  - type: input
    id: description
    attributes:
      label: Feature Description
      description: Clearly describe the feature you'd like to see implemented
      placeholder: As a user, I want to...
    validations:
      required: true
      
  - type: dropdown
    id: priority
    attributes:
      label: Priority
      options:
        - Low
        - Medium
        - High
    validations:
      required: true
      
  - type: dropdown
    id: estimated_size
    attributes:
      label: Estimated Size
      description: How big is this feature?
      options:
        - Small
        - Medium
        - Large
        - XL
    validations:
      required: true
```

## License

MIT