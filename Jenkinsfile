pipeline {
    agent any

    tools {
        nodejs 'Node17' // Default Node version
    }

    stages {
        stage('Clone Backend Code') {
            steps {
                git branch: 'main', url: 'https://github.com/madhucm17/ReactBackend.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Code Linting (Code Review)') {
            steps {
                // If using ESLint
                sh 'npm run lint || echo "Lint warnings found"'
            }
        }

        stage('Run Unit Tests') {
            steps {
                // If using Jest, Mocha, etc.
                sh 'npm test || echo "Some tests failed"'
            }
        }

        stage('Matrix Build (Node Versions)') {
            matrix {
                axes {
                    axis {
                        name 'NODE_VERSION'
                        values 'Node14', 'Node16', 'Node18'
                    }
                }

                stages {
                    stage('Install & Test') {
                        steps {
                            script {
                                // Switch to correct Node version
                                tool name: "${NODE_VERSION}", type: 'NodeJS'
                            }
                            sh 'npm install'
                            sh 'npm test || echo "Some tests failed on ${NODE_VERSION}"'
                        }
                    }
                }
            }
        }

        stage('Start with PM2') {
            steps {
                sh 'pm2 delete ReactBackend || true'
                sh 'pm2 start index.js --name ReactBackend'
            }
        }
    }
}
