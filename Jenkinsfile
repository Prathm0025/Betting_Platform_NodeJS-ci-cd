pipeline {
    agent any

    environment {
        Token = credentials('GITHUB_TOKEN')  // Fetch GitHub token from Jenkins credentials
    }

    triggers {
        // Trigger the pipeline whenever there is a push or merge on the 'dev' branch
        pollSCM('H/1 * * * *')  // Optional: Polls every minute for changes, can be removed if webhooks are configured
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
                    sh '''
                        git config user.email "moreprathmesh849@gmail.com"
                        git config user.name "prathammore0025"

                        # Stash any local changes (though this step is redundant if there are no changes)
                        git stash

                        # Force checkout to the dev-build branch and clean untracked files
                        git checkout -f dev-build
                        git clean -fd

                        # Pull in changes from the dev branch and add the new artifacts
                        git checkout dev -- .
                        git add .
                        git commit -m "Added Builds folder from dev branch"

                        # Force push to dev-build branch
                        git remote set-url origin https://${Token}@github.com/Prathm0025/Betting_Platform_NodeJS-ci-cd.git
                        git push --force origin dev-build
                    '''
                }
            }
        }
    }
}
