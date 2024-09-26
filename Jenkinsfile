pipeline {
    agent any

    environment {
        Token = credentials('GITHUB_TOKEN')  // Fetch GitHub token from Jenkins credentials
    }

    triggers {
        // Trigger the pipeline whenever there is a push or merge on the 'dev' branch
        pollSCM('H/1 * * * *')  // Optional: Polls every 5 minutes for changes, can be removed if webhooks are configured
    }

    stages {
        stage('Clone Repository') {
            steps {
                git url: 'https://github.com/Prathm0025/Betting_Platform_NodeJS-ci-cd.git', branch: 'dev'
            }
        }

        stage('Setup Environment') {
            steps {
                script {
                    // Install dependencies
                    sh 'npm install'
                }
            }
        }

        stage('Build') {
            steps {
                script {
                    // Build the project and handle errors
                    catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                        sh 'npm run build'
                    }
                }
            }
        }

        stage('Push Artifact') {
            when {
                expression { currentBuild.currentResult == 'SUCCESS' }
            }
            steps {
                script {
                    // Configure Git with user details
                    sh 'git config user.email "you@example.com"'
                    sh 'git config user.name "Your Name"'

                    // Check if there are any changes to commit
                    def changes = sh(script: 'git status --porcelain', returnStdout: true).trim()
                    if (changes) {
                        // There are changes, proceed with commit
                        sh 'git add .' // Add your build artifacts from the correct folder
                        sh 'git commit -m "Add new build artifacts"'
                    } else {
                        echo 'No changes to commit'
                    }

                    // Force push to the 'dev-build' branch, overwriting any conflicts
                    sh 'git remote set-url origin https://${Token}@github.com/Prathm0025/Betting_Platform_NodeJS-ci-cd.git'
                    sh 'git push --force origin dev-build'
                }
            }
        }
    }
}
