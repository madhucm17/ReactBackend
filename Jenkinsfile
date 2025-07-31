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
                sh 'npm run lint || echo "Lint warnings found"'
            }
        }

        stage('Run Unit Tests') {
            steps {
                sh 'npm test || echo "Some tests failed"'
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
