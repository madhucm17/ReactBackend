// Jenkinsfile for Node.js Backend
pipeline {
    agent any

    tools {
        nodejs 'Node17'
    }

    stages {
        stage('Clone Backend Code') {
            steps {
                git 'https://github.com/your-username/node-backend-repo.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Start with PM2') {
            steps {
                sh 'pm2 delete my-backend || true'
                sh 'pm2 start index.js --name my-backend'
            }
        }
    }
}
