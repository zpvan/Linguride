pipeline {
    agent any

    tools {
        nodejs 'node-25'
    }

    stages {
        stage('Install Dependencies') {
            steps {
                sh 'npm run install:browser-extension'
            }
        }

        stage('Type Check') {
            steps {
                sh 'npm run typecheck:browser-extension'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint:browser-extension'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build:browser-extension'
            }
        }
    }

    post {
        always {
            echo 'Build process completed.'
        }
    }
}
